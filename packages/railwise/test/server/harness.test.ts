import { describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

Log.init({ print: false })

describe("server.routes.harness", () => {
  test("returns safe default status", async () => {
    const status = await Server.App().request("http://railwise.test/harness/status")

    expect(status.status).toBe(200)
    expect(await status.json()).toMatchObject({
      mode: "safe",
      pendingPermissionCount: 0,
      runningToolCount: 0,
    })
  })
})
