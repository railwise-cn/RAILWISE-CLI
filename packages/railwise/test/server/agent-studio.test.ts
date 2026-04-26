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
  test("workflow run creates a seeded session and updates recent call counts", async () => {
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
    } finally {
      restore(home)
    }
  })
})
