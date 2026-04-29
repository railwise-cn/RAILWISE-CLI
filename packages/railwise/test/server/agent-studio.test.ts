import { describe, expect, test } from "bun:test"
import { mkdir } from "fs/promises"
import path from "path"
import { AgentStudioRoutes } from "../../src/server/routes/agent-studio"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
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
    process.env.RAILWISE_TEST_HOME = tmp.path
    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const response = await AgentStudioRoutes().request("http://railwise.test/workflow/run", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ workflowId: "cpiii-resurvey-wiki" }),
          })
          const result = await response.json()

          expect(response.status).toBe(200)
          expect(result.directory).toBe(tmp.path)
          expect(result.agentNames).toContain("adjustment_computer")
          expect(result.agentNames).toContain("railway_norm_consultant")
          expect(result.prompt).toContain("CPIII 工具执行包")
          expect(result.prompt).toContain("tool_wiki_query")
          expect(result.prompt).toContain("appendLog")
          expect(result.prompt).toContain("tool_format_converter")
          expect(result.prompt).toContain("cosa-in2")
          expect(result.prompt).toContain("tool_adjustment_indirect")
          expect(result.prompt).toContain("tool_gross_error_detection")
          expect(result.prompt).toContain("tool_adjustment_condition")
          expect(result.prompt).toContain("unknowns,dN_CP301,dE_CP301")
          expect(result.prompt).toContain('"conditions"')
          expect(result.prompt).toContain("wiki/log.md")
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
          expect(result.checks.find((item) => item.id === "tools")?.detail).toContain("7 个核心工具")
          expect(result.checks.find((item) => item.id === "norm")?.status).toBe("ok")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("sigma0=")
          expect(result.checks.find((item) => item.id === "adjustment")?.detail).toContain("粗差")
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
