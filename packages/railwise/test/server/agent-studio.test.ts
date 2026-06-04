import { describe, expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { AgentStudioRoutes } from "../../src/server/routes/agent-studio"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { tmpdir } from "../fixture/fixture"
import { Log } from "../../src/util/log"

Log.init({ print: false })

describe("server.routes.agent-studio", () => {
  test("list shows Railwise business agents and hides base coding agents", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path
    await mkdir(path.join(tmp.path, ".railwise", "agent"), { recursive: true })
    await Bun.write(
      path.join(tmp.path, ".railwise", "railwise.json"),
      JSON.stringify({
        version: "2.0",
        system: { domain: "surveying_monitoring" },
        tools: {
          surveying: ["total_station", "gnss", "level"],
          monitoring: ["settlement"],
        },
      }),
    )
    await Bun.write(
      path.join(tmp.path, ".railwise", "agent", "chief_manager.md"),
      "---\ndescription: 主控智能体，负责任务拆解、智能体调度、流程控制与最终成果汇总\nmode: primary\n---\n业务主控。",
    )
    await Bun.write(
      path.join(tmp.path, ".railwise", "agent", "qa_inspector.md"),
      "---\ndescription: 外业数据首检员，负责原始测绘数据审查\nmode: subagent\n---\n外业质检。",
    )

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const response = await AgentStudioRoutes().request("http://railwise.test/list")
        const list = (await response.json()) as { name: string; description?: string; displayName?: string }[]
        const names = list.map((agent) => agent.name)

        expect(response.status).toBe(200)
        expect(names).toContain("chief_manager")
        expect(names).toContain("qa_inspector")
        expect(list.find((agent) => agent.name === "chief_manager")?.displayName).toBe("RAILWISE")
        expect(list.find((agent) => agent.name === "qa_inspector")?.displayName).toBe("外业数据首检")
        expect(names).not.toContain("build")
        expect(names).not.toContain("plan")
        expect(names).not.toContain("general")
        expect(names).not.toContain("explore")
      },
    })
  })

  test("tool and skill inventory endpoints expose collaboration capabilities", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path
    await mkdir(path.join(tmp.path, ".railwise", "skill", "review"), { recursive: true })
    await Bun.write(
      path.join(tmp.path, ".railwise", "skill", "review", "SKILL.md"),
      "---\nname: railwise-review\ndescription: Review engineering delivery quality.\n---\n\nUse this skill for review.",
    )

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const toolResponse = await AgentStudioRoutes().request("http://railwise.test/tool/list")
        const skillResponse = await AgentStudioRoutes().request("http://railwise.test/skill/list")
        const tools = (await toolResponse.json()) as { id: string; label: string; group: string }[]
        const skills = (await skillResponse.json()) as { name: string; description: string; location: string }[]

        expect(toolResponse.status).toBe(200)
        expect(tools.some((tool) => tool.id === "task" && tool.group === "agent")).toBe(true)
        expect(tools.some((tool) => tool.id === "skill" && tool.group === "agent")).toBe(true)
        expect(skillResponse.status).toBe(200)
        expect(skills.some((skill) => skill.name === "railwise-review")).toBe(true)
      },
    })
  })

  test(
    "tool inventory classifies Railwise production tools by professional domain",
    async () => {
      await using tmp = await tmpdir()
      process.env.RAILWISE_TEST_HOME = tmp.path
      await mkdir(path.join(tmp.path, ".railwise", "tool"), { recursive: true })
      await Bun.write(
        path.join(tmp.path, ".railwise", "tool", "survey_calculator.ts"),
        [
          "export const leveling_closure = {",
          "  description: '水准闭合差检核',",
          "  args: {},",
          "  execute: async () => 'ok',",
          "}",
          "",
        ].join("\n"),
      )
      await Bun.write(
        path.join(tmp.path, ".railwise", "tool", "standard_query.ts"),
        [
          "export const query_standard = {",
          "  description: '规范条文查询',",
          "  args: {},",
          "  execute: async () => 'ok',",
          "}",
          "",
        ].join("\n"),
      )

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/tool/list")
          const tools = (await response.json()) as { id: string; label: string; group: string }[]

          expect(response.status).toBe(200)
          expect(tools.find((tool) => tool.id === "survey_calculator_leveling_closure")).toMatchObject({
            label: "水准闭合差检核",
            group: "survey",
          })
          expect(tools.find((tool) => tool.id === "standard_query_query_standard")).toMatchObject({
            label: "规范条文查询",
            group: "knowledge",
          })
        },
      })
    },
    { timeout: 10_000 },
  )

  test(
    "tool inventory keeps core tools when a local custom tool is broken",
    async () => {
      await using tmp = await tmpdir()
      process.env.RAILWISE_TEST_HOME = tmp.path
      await mkdir(path.join(tmp.path, ".railwise", "tools"), { recursive: true })
      await Bun.write(path.join(tmp.path, ".railwise", "tools", "broken.ts"), 'throw new Error("broken custom tool")\n')

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/tool/list")
          const tools = (await response.json()) as { id: string; group: string }[]

          expect(response.status).toBe(200)
          expect(tools.some((tool) => tool.id === "task" && tool.group === "agent")).toBe(true)
          expect(tools.some((tool) => tool.id === "read" && tool.group === "core")).toBe(true)
        },
      })
    },
    { timeout: 10_000 },
  )

  test("workflow run creates a seeded session and updates recent call counts", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path
    await mkdir(path.join(tmp.path, ".railwise", "agent"), { recursive: true })
    await Bun.write(
      path.join(tmp.path, ".railwise", "agent", "chief_manager.md"),
      "---\ndescription: Chief agent\nmode: primary\n---\nSeeded chief prompt.",
    )

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const response = await AgentStudioRoutes().request("http://railwise.test/workflow/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workflowId: "metro-monitoring-report", input: { project: "E2E" } }),
        })
        const result = await response.json()

        expect(response.status).toBe(200)
        expect(result.sessionTitle).toBe("工作流：地铁月度监测报告流水线")
        expect(result.agentNames).toContain("chief_manager")

        const session = await Session.get(result.sessionId)
        const messages = await Session.messages({ sessionID: result.sessionId })

        expect(session.title).toBe(result.sessionTitle)
        expect(messages[0]?.info.agent).toBe("chief_manager")
        expect(messages[0]?.parts[0]?.type).toBe("text")
        expect(messages[0]?.parts[0]?.type === "text" ? messages[0].parts[0].text : "").toContain(
          "地铁月度监测报告流水线",
        )

        const listResponse = await AgentStudioRoutes().request("http://railwise.test/list")
        const list = (await listResponse.json()) as { name: string; callCount7d?: number }[]
        const chief = list.find((agent: { name: string }) => agent.name === "chief_manager")
        expect(chief?.callCount7d).toBeGreaterThanOrEqual(1)
      },
    })
  })

  test("workflow presets cover professional surveying business scenarios", async () => {
    await using tmp = await tmpdir()
    process.env.RAILWISE_TEST_HOME = tmp.path

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const response = await AgentStudioRoutes().request("http://railwise.test/workflow/presets")
        const workflows = (await response.json()) as Array<{
          id: string
          description: string
          nodes: { label: string; agent: string }[]
        }>
        const ids = workflows.map((workflow) => workflow.id)
        const labels = workflows.flatMap((workflow) => workflow.nodes.map((node) => node.label))

        expect(response.status).toBe(200)
        expect(ids).toContain("metro-monitoring-report")
        expect(ids).toContain("cpiii-control-network-report")
        expect(ids).toContain("deep-foundation-pit-monitoring")
        expect(ids).toContain("standards-wiki-ingest")
        expect(labels.some((label) => /QA|researcher|writer|editor|总指挥|大师|技术写作/.test(label))).toBe(false)
        expect(
          workflows.some((workflow) => workflow.nodes.some((node) => node.agent === "adjustment_computer")),
        ).toBe(true)
        expect(workflows.some((workflow) => workflow.nodes.some((node) => node.agent === "norm_librarian"))).toBe(true)
      },
    })
  })
})
