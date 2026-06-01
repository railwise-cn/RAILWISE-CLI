import { afterEach, describe, expect, test } from "bun:test"
import { Marketplace } from "../../src/marketplace"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

Log.init({ print: false })

afterEach(() => Marketplace.reset())

describe("server.routes.marketplace", () => {
  test("returns built-in capabilities", async () => {
    const capabilities = await Server.App().request("http://railwise.test/marketplace/capabilities")
    const body = (await capabilities.json()) as { data: unknown[] }

    expect(capabilities.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
  })

  test("persists enabled state through marketplace reads", async () => {
    const app = Server.App()
    const enabled = await app.request("http://railwise.test/marketplace/capabilities/railwise.mcp.local_tools/enable", {
      method: "POST",
    })
    const detail = await app.request("http://railwise.test/marketplace/capabilities/railwise.mcp.local_tools")
    const list = await app.request("http://railwise.test/marketplace/capabilities")
    const item = (await detail.json()) as { enabled: boolean }
    const body = (await list.json()) as { data: { id: string; enabled: boolean }[] }

    expect(enabled.status).toBe(200)
    expect(item.enabled).toBe(true)
    expect(body.data.find((item) => item.id === "railwise.mcp.local_tools")?.enabled).toBe(true)
  })

  test("enabled marketplace capabilities change harness capacity", async () => {
    const app = Server.App()
    const before = await app.request("http://railwise.test/harness/status")
    const base = (await before.json()) as { capabilityCount: number }

    await app.request("http://railwise.test/marketplace/capabilities/railwise.mcp.local_tools/enable", {
      method: "POST",
    })

    const after = await app.request("http://railwise.test/harness/status")
    const current = (await after.json()) as { capabilityCount: number }

    expect(after.status).toBe(200)
    expect(current.capabilityCount).toBe(base.capabilityCount + 1)
  })
})
