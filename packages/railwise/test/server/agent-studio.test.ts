import { describe, expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { AgentStudioRoutes } from "../../src/server/routes/agent-studio"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { Identifier } from "../../src/id/id"
import type { MessageV2 } from "../../src/session/message-v2"
import { tmpdir } from "../fixture/fixture"
import { Log } from "../../src/util/log"

Log.init({ print: false })

function restore(home: string | undefined) {
  if (home === undefined) {
    delete process.env.RAILWISE_TEST_HOME
    return
  }
  process.env.RAILWISE_TEST_HOME = home
}

async function writeUser(sessionID: string, text: string) {
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID,
    agent: "chief_manager",
    model: {
      providerID: "test",
      modelID: "test",
    },
    time: {
      created: Date.now(),
    },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: message.id,
    sessionID,
    type: "text",
    text,
  })
  return message
}

async function writeAssistant(sessionID: string, parentID: string, text: string) {
  const message = await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "assistant",
    sessionID,
    mode: "build",
    agent: "chief_manager",
    path: {
      cwd: ".",
      root: ".",
    },
    cost: 0,
    tokens: {
      output: 0,
      input: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    modelID: "test",
    providerID: "test",
    parentID,
    time: {
      created: Date.now(),
      completed: Date.now(),
    },
    finish: "end_turn",
  } satisfies MessageV2.Assistant)
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: message.id,
    sessionID,
    type: "text",
    text,
  })
  return message
}

describe("server.routes.agent-studio", () => {
  test("lists M8 wiki agents and CPIII workflow preset", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/list")
          const list = (await response.json()) as { name: string; hidden?: boolean }[]
          const names = list.map((agent) => agent.name)

          expect(response.status).toBe(200)
          expect(names).toContain("norm_librarian")
          expect(names).toContain("source_ingestor")
          expect(names).toContain("knowledge_curator")
          expect(names).toContain("cpiii_specialist")
          expect(names).toContain("adjustment_computer")
          expect(names).toContain("railway_norm_consultant")
          expect(names).toContain("chief_manager")

          const presetResponse = await AgentStudioRoutes().request("http://railwise.test/workflow/presets")
          const workflows = (await presetResponse.json()) as {
            id: string
            nodes: { agent: string }[]
          }[]
          const workflow = workflows.find((item) => item.id === "cpiii-resurvey-wiki")

          expect(presetResponse.status).toBe(200)
          expect(workflow?.nodes.map((node) => node.agent)).toEqual([
            "source_ingestor",
            "norm_librarian",
            "railway_norm_consultant",
            "adjustment_computer",
            "cpiii_specialist",
            "knowledge_curator",
            "chief_manager",
          ])
        },
      })
    } finally {
      restore(home)
    }
  })

  test("workflow run creates a session and returns a reusable prompt", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
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
          expect(result.directory).toBe(tmp.path)
          expect(result.prompt).toContain("地铁月度监测报告流水线")
          expect(result.agentNames).toContain("chief_manager")

          const session = await Session.get(result.sessionId)
          const messages = await Session.messages({ sessionID: result.sessionId })

          expect(session.title).toBe(result.sessionTitle)
          expect(messages).toEqual([])

          const listResponse = await AgentStudioRoutes().request("http://railwise.test/list")
          const list = (await listResponse.json()) as { name: string; callCount7d?: number }[]
          const chief = list.find((agent: { name: string }) => agent.name === "chief_manager")
          expect(chief?.callCount7d).toBe(0)
        },
      })
    } finally {
      restore(home)
    }
  })

  test("CPIII workflow run seeds an executable tool package", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    const library = process.env.RAILWISE_NORM_LIBRARY
    process.env.RAILWISE_TEST_HOME = tmp.path
    delete process.env.RAILWISE_NORM_LIBRARY
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/workflow/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki" }),
          })
          const result = (await response.json()) as {
            sessionId: string
            directory: string
            workflowId: string
            agentNames: string[]
            prompt: string
            artifacts: {
              kind: string
              title: string
              markdownPath: string
              absoluteMarkdownPath: string
              jsonPath: string
              absoluteJsonPath: string
            }[]
          }
          const artifact = result.artifacts[0]

          expect(response.status).toBe(200)
          expect(result.directory).toBe(tmp.path)
          expect(result.workflowId).toBe("cpiii-resurvey-wiki")
          expect(result.agentNames).toContain("adjustment_computer")
          expect(result.agentNames).toContain("railway_norm_consultant")
          expect(artifact.kind).toBe("format-coverage")
          expect(artifact.title).toBe("格式兼容性质检报告")
          expect(artifact.markdownPath.startsWith("wiki/changes/format-coverage-")).toBe(true)
          expect(artifact.markdownPath.endsWith(".md")).toBe(true)
          expect(artifact.jsonPath).toBe(artifact.markdownPath.replace(/\.md$/, ".json"))
          expect(result.prompt).toContain("CPIII 工具执行包")
          expect(result.prompt).toContain("tool_wiki_query")
          expect(result.prompt).toContain("appendLog")
          expect(result.prompt).toContain("tool_format_converter")
          expect(result.prompt).toContain("NASEW .dat")
          expect(result.prompt).toContain("TBC CSV")
          expect(result.prompt).toContain("cosa-in2")
          expect(result.prompt).toContain("tool_adjustment_indirect")
          expect(result.prompt).toContain("tool_adjustment_free_network")
          expect(result.prompt).toContain("tool_gross_error_detection")
          expect(result.prompt).toContain("tool_adjustment_robust")
          expect(result.prompt).toContain("tool_variance_component")
          expect(result.prompt).toContain("tool_adjustment_condition")
          expect(result.prompt).toContain("unknowns,dN_CP301,dE_CP301")
          expect(result.prompt).toContain('"conditions"')
          expect(result.prompt).toContain(`格式兼容性质检报告 Markdown: ${artifact.markdownPath}`)
          expect(result.prompt).toContain(`格式兼容性质检报告 JSON: ${artifact.jsonPath}`)
          expect(result.prompt).toContain(`本地 Markdown: ${artifact.absoluteMarkdownPath}`)
          expect(result.prompt).toContain("交付验收硬性要求")
          expect(result.prompt).toContain("technical_writer 的复测预案或技术报告必须包含「附件引用」小节")
          expect(result.prompt).toContain("knowledge_curator 的维护摘要必须记录同一组 Markdown 与 JSON 路径")
          expect(result.prompt).toContain("不完整交付")
          expect(result.prompt).toContain("wiki/log.md")

          const markdown = await Bun.file(artifact.absoluteMarkdownPath).text()
          const json = (await Bun.file(artifact.absoluteJsonPath).json()) as {
            sampleCount: number
            warningCount: number
          }

          expect(markdown).toContain("# RAILWISE Format Coverage Report")
          expect(markdown).toContain("Ready count: 6")
          expect(json.sampleCount).toBe(6)
          expect(json.warningCount).toBe(2)

          const metadataResponse = await AgentStudioRoutes().request(
            `http://railwise.test/workflow/session/${result.sessionId}`,
          )
          const metadata = (await metadataResponse.json()) as {
            sessionId: string
            workflowId: string
            workflowName: string
            artifacts: typeof result.artifacts
          }

          expect(metadataResponse.status).toBe(200)
          expect(metadata.sessionId).toBe(result.sessionId)
          expect(metadata.workflowId).toBe("cpiii-resurvey-wiki")
          expect(metadata.workflowName).toBe("CPIII 规范查询与复测预案")
          expect(metadata.artifacts[0]?.markdownPath).toBe(artifact.markdownPath)
        },
      })
    } finally {
      restore(home)
      if (library === undefined) {
        delete process.env.RAILWISE_NORM_LIBRARY
      } else {
        process.env.RAILWISE_NORM_LIBRARY = library
      }
    }
  })

  test("accepts completed CPIII delivery with artifacts citations and tool summary", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "CPIII acceptance" })
          const md = "wiki/changes/format-coverage-2026-04-30.md"
          const json = "wiki/changes/format-coverage-2026-04-30.json"
          const user = await writeUser(
            session.id,
            `工作流附件：\n- 格式兼容性质检报告 Markdown: ${md}\n- 格式兼容性质检报告 JSON: ${json}`,
          )
          await writeAssistant(
            session.id,
            user.id,
            [
              "# CPIII 复测预案",
              "",
              "## 附件引用",
              `- 格式兼容性质检报告 Markdown: ${md}`,
              `- 格式兼容性质检报告 JSON: ${json}`,
              "",
              "## 规范引用",
              "- wiki_page_path: wiki/clauses/cpiii-precision.md",
              "- raw_source_md: raw/tb10601.md",
              "- norm_clause_id: TB10601-3.1",
              "",
              "## 工具结果摘要",
              "- 格式样本 6/6 可用，warning 2 条。",
              "- sigma0、残差、自由网、粗差、稳健、方差分量、条件平差均已汇总。",
            ].join("\n"),
          )

          const response = await AgentStudioRoutes().request("http://railwise.test/workflow/acceptance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki", sessionId: session.id }),
          })
          const result = (await response.json()) as {
            ok: boolean
            messageCount: number
            checks: { id: string; status: string; detail: string }[]
          }

          expect(response.status).toBe(200)
          expect(result.ok).toBe(true)
          expect(result.messageCount).toBe(2)
          expect(result.checks.find((check) => check.id === "artifacts")?.status).toBe("ok")
          expect(result.checks.find((check) => check.id === "artifact-section")?.status).toBe("ok")
          expect(result.checks.find((check) => check.id === "norm-citation")?.status).toBe("ok")
          expect(result.checks.find((check) => check.id === "tool-summary")?.status).toBe("ok")

          const metadataResponse = await AgentStudioRoutes().request(
            `http://railwise.test/workflow/session/${session.id}`,
          )
          const metadata = (await metadataResponse.json()) as {
            acceptance: { ok: boolean; messageCount: number }
          }

          expect(metadataResponse.status).toBe(200)
          expect(metadata.acceptance.ok).toBe(true)
          expect(metadata.acceptance.messageCount).toBe(2)
        },
      })
    } finally {
      restore(home)
    }
  })

  test("archives accepted CPIII delivery summary", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "CPIII archive" })
          const md = "wiki/changes/format-coverage-2026-04-30.md"
          const json = "wiki/changes/format-coverage-2026-04-30.json"
          const root = path.join(tmp.path, ".railwise", "norm-library")
          await mkdir(path.join(root, "wiki", "changes"), { recursive: true })
          await Bun.write(path.join(root, md), "# Format coverage\n")
          await Bun.write(path.join(root, json), '{"ready":true}\n')
          const user = await writeUser(
            session.id,
            `工作流附件：\n- 格式兼容性质检报告 Markdown: ${md}\n- 格式兼容性质检报告 JSON: ${json}`,
          )
          await writeAssistant(
            session.id,
            user.id,
            [
              "# CPIII 复测预案",
              "",
              "## 附件引用",
              `- 格式兼容性质检报告 Markdown: ${md}`,
              `- 格式兼容性质检报告 JSON: ${json}`,
              "",
              "## 规范引用",
              "- wiki_page_path: wiki/clauses/cpiii-precision.md",
              "- raw_source_md: raw/tb10601.md",
              "- norm_clause_id: TB10601-3.1",
              "",
              "## 工具结果摘要",
              "- 格式样本 6/6 可用，warning 2 条。",
              "- sigma0、残差、自由网、粗差、稳健、方差分量、条件平差均已汇总。",
            ].join("\n"),
          )

          const accepted = await AgentStudioRoutes().request("http://railwise.test/workflow/acceptance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki", sessionId: session.id }),
          })
          const archived = await AgentStudioRoutes().request("http://railwise.test/workflow/delivery/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki", sessionId: session.id }),
          })
          const result = (await archived.json()) as {
            directoryPath: string
            absoluteDirectoryPath: string
            markdownPath: string
            absoluteMarkdownPath: string
            manifestPath: string
            absoluteManifestPath: string
            fileCount: number
            files: { kind: string; path: string; copied: boolean; sourcePath?: string }[]
          }
          const markdown = await Bun.file(result.absoluteMarkdownPath).text()
          const manifest = (await Bun.file(result.absoluteManifestPath).json()) as {
            delivery: { fileCount: number }
            references: { path: string }[]
          }
          const metadataResponse = await AgentStudioRoutes().request(
            `http://railwise.test/workflow/session/${session.id}`,
          )
          const metadata = (await metadataResponse.json()) as {
            delivery: { directoryPath: string; markdownPath: string; manifestPath: string; fileCount: number }
          }

          expect(accepted.status).toBe(200)
          expect(archived.status).toBe(200)
          expect(result.directoryPath).toContain(".railwise/workflow-deliveries/")
          expect(result.markdownPath).toContain("/summary.md")
          expect(result.manifestPath).toContain("/manifest.json")
          expect(result.fileCount).toBe(4)
          expect(result.files.filter((file) => file.copied)).toHaveLength(4)
          expect(result.files.find((file) => file.sourcePath === md)?.path).toContain("artifact-01.md")
          expect(result.files.find((file) => file.sourcePath === json)?.path).toContain("artifact-02.json")
          expect(markdown).toContain("# CPIII 规范查询与复测预案 交付摘要")
          expect(markdown).toContain("## 交付包文件")
          expect(markdown).toContain(md)
          expect(markdown).toContain(json)
          expect(markdown).toContain("## 验收检查")
          expect(await Bun.file(path.join(result.absoluteDirectoryPath, "artifact-01.md")).text()).toContain(
            "Format coverage",
          )
          expect(await Bun.file(path.join(result.absoluteDirectoryPath, "artifact-02.json")).json()).toEqual({
            ready: true,
          })
          expect(manifest.delivery.fileCount).toBe(4)
          expect(manifest.references.map((reference) => reference.path)).toContain(md)
          expect(metadata.delivery.markdownPath).toBe(result.markdownPath)
          expect(metadata.delivery.directoryPath).toBe(result.directoryPath)
          expect(metadata.delivery.manifestPath).toBe(result.manifestPath)
          expect(metadata.delivery.fileCount).toBe(4)
        },
      })
    } finally {
      restore(home)
    }
  })

  test("rejects CPIII delivery missing final artifact references", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({ title: "CPIII incomplete delivery" })
          const user = await writeUser(
            session.id,
            [
              "工作流附件：",
              "- 格式兼容性质检报告 Markdown: wiki/changes/format-coverage-2026-04-30.md",
              "- 格式兼容性质检报告 JSON: wiki/changes/format-coverage-2026-04-30.json",
            ].join("\n"),
          )
          await writeAssistant(session.id, user.id, "完成 CPIII 复测预案，后续可补充附件。")

          const response = await AgentStudioRoutes().request("http://railwise.test/workflow/acceptance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki", sessionId: session.id }),
          })
          const result = (await response.json()) as {
            ok: boolean
            checks: { id: string; status: string; detail: string }[]
          }

          expect(response.status).toBe(200)
          expect(result.ok).toBe(false)
          expect(result.checks.find((check) => check.id === "artifacts")?.status).toBe("fail")
          expect(result.checks.find((check) => check.id === "artifact-section")?.status).toBe("fail")
          expect(result.checks.find((check) => check.id === "norm-citation")?.status).toBe("fail")
          expect(result.checks.find((check) => check.id === "tool-summary")?.status).toBe("fail")
        },
      })
    } finally {
      restore(home)
    }
  })

  test("checks CPIII workflow readiness with deterministic tool coverage", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    const library = process.env.RAILWISE_NORM_LIBRARY
    process.env.RAILWISE_TEST_HOME = tmp.path
    delete process.env.RAILWISE_NORM_LIBRARY
    try {
      const root = path.join(tmp.path, ".railwise", "norm-library")
      await mkdir(path.join(root, "wiki", "clauses"), { recursive: true })
      await mkdir(path.join(root, "raw"), { recursive: true })
      await Bun.write(
        path.join(root, "raw", "tb10601.md"),
        "# TB10601 CPIII Raw\n\n参照 TB10601 第 3.1 条，CPIII 控制网应复测。",
      )
      await Bun.write(
        path.join(root, "wiki", "clauses", "cpiii.md"),
        "# CPIII 复测\n\n参照 TB10601 第 3.1 条，CPIII 控制网应复测。",
      )
      await Bun.write(
        path.join(root, "wiki", "index.md"),
        "# RAILWISE Norm Wiki Index\n\n- [CPIII 复测](clauses/cpiii.md): TB10601 3.1\n",
      )

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request(
            "http://railwise.test/workflow/check/cpiii-resurvey-wiki",
          )
          const result = (await response.json()) as {
            ok: boolean
            checks: { id: string; status: string; detail: string }[]
          }

          expect(response.status).toBe(200)
          expect(result.ok).toBe(true)
          expect(result.checks.find((item) => item.id === "agents")?.status).toBe("ok")
          expect(result.checks.find((item) => item.id === "tools")?.status).toBe("ok")
          expect(result.checks.find((item) => item.id === "tools")?.detail).toContain("10 个核心工具")
          expect(result.checks.find((item) => item.id === "norm")?.status).toBe("ok")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("格式 5/5 种")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("样本集 6/6 可用")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("容错样本 可用")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("warning 2 条")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("sigma0=")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("自由网")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("粗差")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("稳健")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("方差分量")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("条件")
          expect(result.checks.find((item) => item.id === "activity")?.status).toBe("warn")
        },
      })
    } finally {
      restore(home)
      if (library === undefined) delete process.env.RAILWISE_NORM_LIBRARY
      else process.env.RAILWISE_NORM_LIBRARY = library
    }
  })

  test("reports format sample coverage diagnostics", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    const library = process.env.RAILWISE_NORM_LIBRARY
    process.env.RAILWISE_TEST_HOME = tmp.path
    delete process.env.RAILWISE_NORM_LIBRARY
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/format/report")
          const result = (await response.json()) as {
            sampleCount: number
            readyCount: number
            formatCount: number
            coveredFormatCount: number
            warningCount: number
            samples: {
              id: string
              detectedFormat: string
              ready: boolean
              warningLines: number[]
              nextTool?: string
              equationCount: number
              unknowns: string[]
            }[]
            artifacts: {
              markdownPath: string
              absoluteMarkdownPath: string
              jsonPath: string
              absoluteJsonPath: string
            }
          }
          const damaged = result.samples.find((sample) => sample.id === "south-damaged")
          const cosa = result.samples.find((sample) => sample.id === "cosa-in2")

          expect(response.status).toBe(200)
          expect(result.sampleCount).toBe(6)
          expect(result.readyCount).toBe(6)
          expect(result.formatCount).toBe(5)
          expect(result.coveredFormatCount).toBe(5)
          expect(result.warningCount).toBe(2)
          expect(cosa?.nextTool).toBe("tool_adjustment_indirect")
          expect(cosa?.equationCount).toBe(3)
          expect(cosa?.unknowns).toEqual(["dN_CP301", "dE_CP301"])
          expect(damaged?.detectedFormat).toBe("south-in")
          expect(damaged?.ready).toBe(true)
          expect(damaged?.warningLines).toEqual([6, 7])
          expect(result.artifacts.markdownPath.startsWith("wiki/changes/format-coverage-")).toBe(true)
          expect(result.artifacts.markdownPath.endsWith(".md")).toBe(true)
          expect(result.artifacts.jsonPath).toBe(result.artifacts.markdownPath.replace(/\.md$/, ".json"))

          const markdown = await Bun.file(result.artifacts.absoluteMarkdownPath).text()
          const json = (await Bun.file(result.artifacts.absoluteJsonPath).json()) as {
            sampleCount: number
            warningCount: number
          }

          expect(markdown).toContain("# RAILWISE Format Coverage Report")
          expect(markdown).toContain("Ready count: 6")
          expect(markdown).toContain("JSON attachment: ")
          expect(markdown).toContain("South .in damaged but usable")
          expect(json.sampleCount).toBe(6)
          expect(json.warningCount).toBe(2)

          const statusResponse = await AgentStudioRoutes().request("http://railwise.test/wiki/status")
          const status = (await statusResponse.json()) as {
            reports: {
              path: string
              kind: string
              sampleCount?: number
              readyCount?: number
              warningCount?: number
              jsonPath?: string
            }[]
          }
          const report = status.reports.find((item) => item.kind === "format")

          expect(report?.path).toBe(result.artifacts.markdownPath)
          expect(report?.sampleCount).toBe(6)
          expect(report?.readyCount).toBe(6)
          expect(report?.warningCount).toBe(2)
          expect(report?.jsonPath).toBe(result.artifacts.jsonPath)
        },
      })
    } finally {
      restore(home)
      if (library === undefined) {
        delete process.env.RAILWISE_NORM_LIBRARY
      } else {
        process.env.RAILWISE_NORM_LIBRARY = library
      }
    }
  })

  test("reports norm wiki status and recent change reports", async () => {
    await using tmp = await tmpdir()
    const home = process.env.RAILWISE_TEST_HOME
    const library = process.env.RAILWISE_NORM_LIBRARY
    process.env.RAILWISE_TEST_HOME = tmp.path
    delete process.env.RAILWISE_NORM_LIBRARY
    try {
      const root = path.join(tmp.path, ".railwise", "norm-library")
      await mkdir(path.join(root, "wiki", "clauses"), { recursive: true })
      await mkdir(path.join(root, "wiki", "changes"), { recursive: true })
      await mkdir(path.join(root, "raw"), { recursive: true })
      await Bun.write(
        path.join(root, "raw", "tb10601.md"),
        "# TB10601 CPIII Raw\n\n参照 TB10601 第 3.1 条，CPIII 控制网应复测。",
      )
      await Bun.write(
        path.join(root, "wiki", "clauses", "cpiii.md"),
        [
          "---",
          "source_raw: raw/tb10601.md",
          "norm_clause_id: TB10601 3.1",
          "source_hash: raw-hash",
          "---",
          "",
          "# CPIII 复测",
          "",
          "参照 TB10601 第 3.1 条，CPIII 控制网应复测。",
          "",
        ].join("\n"),
      )
      await Bun.write(
        path.join(root, "wiki", "index.md"),
        "# RAILWISE Norm Wiki Index\n\n- [CPIII 复测](clauses/cpiii.md): TB10601 3.1\n",
      )
      await Bun.write(
        path.join(root, "wiki", "log.md"),
        [
          "# Query Log",
          "",
          '- 2026-04-29T00:00:00.000Z query="CPIII 高程精度要求" hits=wiki/clauses/cpiii.md',
          "## [2026-04-29] ingest | CPIII 复测 | pages=wiki/clauses/cpiii.md",
          "",
        ].join("\n"),
      )
      await Bun.write(
        path.join(root, "wiki", "changes", "lint-2026-04-29.md"),
        [
          "# RAILWISE Norm Wiki Lint Report",
          "",
          "Generated: 2026-04-29T00:00:00.000Z",
          "Status: needs_attention",
          "Problem count: 2",
          "",
        ].join("\n"),
      )
      await Bun.write(
        path.join(root, "wiki", "changes", "diff-tb10601-to-tb10601-2026-04-29.md"),
        [
          "# RAILWISE Norm Wiki Change Report",
          "",
          "Generated: 2026-04-29T00:00:00.000Z",
          "From: TB10601",
          "To: TB10601",
          "Change count: 1",
          "",
        ].join("\n"),
      )

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/wiki/status")
          const status = (await response.json()) as {
            readonly: boolean
            pageCount: number
            rawCount: number
            indexPath?: string
            reportCount: number
            reports: { path: string; kind: string; problemCount?: number; changeCount?: number }[]
            logCount: number
            logs: { kind: string; title: string; paths: string[] }[]
          }

          expect(response.status).toBe(200)
          expect(status.readonly).toBe(false)
          expect(status.pageCount).toBe(1)
          expect(status.rawCount).toBe(1)
          expect(status.indexPath).toBe("wiki/index.md")
          expect(status.reportCount).toBe(2)
          expect(status.reports.map((report) => report.path)).toContain("wiki/changes/lint-2026-04-29.md")
          expect(status.reports.map((report) => report.path)).toContain(
            "wiki/changes/diff-tb10601-to-tb10601-2026-04-29.md",
          )
          expect(status.logCount).toBe(2)
          expect(status.logs[0]).toMatchObject({
            kind: "ingest",
            title: "CPIII 复测",
            paths: ["wiki/clauses/cpiii.md"],
          })
          expect(status.logs[1]).toMatchObject({
            kind: "query",
            title: "CPIII 高程精度要求",
            paths: ["wiki/clauses/cpiii.md"],
          })
          expect(status.reports.find((report) => report.kind === "lint")?.problemCount).toBe(2)
          expect(status.reports.find((report) => report.kind === "diff")?.changeCount).toBe(1)

          const detailResponse = await AgentStudioRoutes().request(
            "http://railwise.test/wiki/report?path=wiki%2Fchanges%2Flint-2026-04-29.md",
          )
          const detail = (await detailResponse.json()) as {
            path: string
            rawMarkdown: string
            problemCount?: number
          }

          expect(detailResponse.status).toBe(200)
          expect(detail.path).toBe("wiki/changes/lint-2026-04-29.md")
          expect(detail.problemCount).toBe(2)
          expect(detail.rawMarkdown).toContain("Problem count: 2")

          const escapeResponse = await AgentStudioRoutes().request(
            "http://railwise.test/wiki/report?path=..%2Fraw%2Ftb10601.md",
          )

          expect(escapeResponse.status).toBe(404)
        },
      })
    } finally {
      restore(home)
      if (library === undefined) {
        delete process.env.RAILWISE_NORM_LIBRARY
      } else {
        process.env.RAILWISE_NORM_LIBRARY = library
      }
    }
  })
})
