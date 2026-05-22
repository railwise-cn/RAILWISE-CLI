import { describe, expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { HarnessRoutes } from "../../src/server/routes/harness"
import { tmpdir } from "../fixture/fixture"

describe("server.routes.harness", () => {
  test("returns a safe Harness status", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const response = await HarnessRoutes().request("http://railwise.test/status")
        const body = (await response.json()) as { mode: string; capabilityCount: number; workspace: string }

        expect(response.status).toBe(200)
        expect(body.mode).toBe("safe")
        expect(body.workspace).toBe(tmp.path)
        expect(body.capabilityCount).toBeGreaterThan(0)
      },
    })
  })

  test("records permission decisions into the timeline", async () => {
    const response = await HarnessRoutes().request("http://railwise.test/session/ses_test/permission/perm_read", {
      method: "POST",
      body: JSON.stringify({ action: "allow" }),
      headers: {
        "content-type": "application/json",
      },
    })
    const event = (await response.json()) as { type: string; sessionID: string }
    const timeline = await HarnessRoutes().request("http://railwise.test/session/ses_test/timeline")
    const events = (await timeline.json()) as { type: string }[]

    expect(response.status).toBe(200)
    expect(event.type).toBe("permission.resolved")
    expect(event.sessionID).toBe("ses_test")
    expect(events.some((item) => item.type === "permission.resolved")).toBe(true)
  })
})
