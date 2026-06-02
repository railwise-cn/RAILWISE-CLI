import { describe, expect, test } from "bun:test"
import { HarnessRoutes } from "../../src/server/routes/harness"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

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
})
