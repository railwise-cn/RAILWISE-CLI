import { describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { HarnessRoutes } from "../../src/server/routes/harness"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

describe("server.routes.harness", () => {
  test("status returns safe default runtime state", async () => {
    const response = await HarnessRoutes().request("http://railwise.test/status")
    const status = await response.json()

    expect(response.status).toBe(200)
    expect(status).toMatchObject({ mode: "safe" })
    expect(status.capabilityCount).toBeGreaterThan(0)
    expect(status.pendingPermissionCount).toBe(0)
    expect(status.runningToolCount).toBe(0)
  })

  test("server app mounts harness status", async () => {
    const response = await Server.App().request("/harness/status")
    const status = await response.json()

    expect(response.status).toBe(200)
    expect(status.mode).toBe("safe")
  })

  test("timeline derives execution events from persisted session tool parts", async () => {
    await using tmp = await tmpdir()

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ title: "运营期监测预警复核" })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "user",
          sessionID: session.id,
          agent: "chief_manager",
          model: {
            providerID: "deepseek",
            modelID: "deepseek-v4",
          },
          time: {
            created: 1779498000000,
          },
        })
        const assistant = await Session.updateMessage({
          id: Identifier.ascending("message"),
          role: "assistant",
          sessionID: session.id,
          parentID: user.id,
          mode: "build",
          agent: "chief_manager",
          path: {
            cwd: tmp.path,
            root: tmp.path,
          },
          cost: 0,
          tokens: {
            input: 0,
            output: 0,
            reasoning: 0,
            cache: {
              read: 0,
              write: 0,
            },
          },
          modelID: "deepseek-v4",
          providerID: "deepseek",
          time: {
            created: 1779498000100,
            completed: 1779498000300,
          },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          messageID: assistant.id,
          sessionID: session.id,
          type: "tool",
          callID: "call_01",
          tool: "survey_calculator_leveling_closure",
          state: {
            status: "completed",
            input: {
              closure_mm: 3,
              route_km: 1,
            },
            output: "闭合差满足限差。",
            title: "水准闭合差检核",
            metadata: {
              pass: true,
            },
            time: {
              start: 1779498000120,
              end: 1779498000180,
            },
          },
        })

        const response = await HarnessRoutes().request(`http://railwise.test/session/${session.id}/timeline`)
        const events = await response.json()

        expect(response.status).toBe(200)
        expect(events.map((event: { type: string }) => event.type)).toContain("session.started")
        expect(events.map((event: { type: string }) => event.type)).toContain("model.selected")
        expect(events.map((event: { type: string }) => event.type)).toContain("agent.selected")
        expect(events.map((event: { type: string }) => event.type)).toContain("tool.started")
        expect(events.map((event: { type: string }) => event.type)).toContain("tool.completed")
        expect(events.find((event: { type: string }) => event.type === "tool.completed")).toMatchObject({
          title: "水准闭合差检核",
          capabilityID: "railwise.tool.survey_calculator_leveling_closure",
          duration: 60,
        })
      },
    })
  })
})
