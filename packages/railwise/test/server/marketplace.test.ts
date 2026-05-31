import { describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

Log.init({ print: false })

describe("server.routes.marketplace", () => {
  test("returns built-in capabilities", async () => {
    const capabilities = await Server.App().request("http://railwise.test/marketplace/capabilities")
    const body = (await capabilities.json()) as { data: unknown[] }

    expect(capabilities.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
  })
})
