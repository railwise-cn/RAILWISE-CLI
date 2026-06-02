import { describe, expect, test } from "bun:test"
import { MarketplaceRoutes } from "../../src/server/routes/marketplace"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

Log.init({ print: false })

describe("server.routes.marketplace", () => {
  test("capabilities returns built-in capability registry", async () => {
    const response = await MarketplaceRoutes().request("http://railwise.test/capabilities")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.some((item: { kind: string }) => item.kind === "harness_profile")).toBe(true)
  })

  test("server app mounts marketplace capabilities", async () => {
    const response = await Server.App().request("/marketplace/capabilities")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.some((item: { id: string }) => item.id === "railwise.agent.chief_manager")).toBe(true)
  })
})
