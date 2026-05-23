import { describe, expect, test } from "bun:test"
import path from "path"
import { Marketplace } from "../../src/marketplace"
import { MarketplaceRoutes } from "../../src/server/routes/marketplace"
import { tmpdir } from "../fixture/fixture"

async function isolate() {
  const tmp = await tmpdir()
  Marketplace.configure(path.join(tmp.path, "marketplace.json"))
  return tmp
}

describe("server.routes.marketplace", () => {
  test("lists Harness marketplace capabilities", async () => {
    await using _ = await isolate()
    const response = await MarketplaceRoutes().request("http://railwise.test/capabilities")
    const body = (await response.json()) as { data: { id: string; permissions: object }[] }

    expect(response.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.some((item) => item.id === "railwise.harness.safe")).toBe(true)
    expect(body.data.every((item) => item.permissions)).toBe(true)
  })

  test("enables and disables a capability", async () => {
    await using _ = await isolate()
    const enabled = await MarketplaceRoutes().request(
      "http://railwise.test/capabilities/railwise.provider.deepseek/enable",
      { method: "POST" },
    )
    const active = (await enabled.json()) as { enabled: boolean }
    const disabled = await MarketplaceRoutes().request(
      "http://railwise.test/capabilities/railwise.provider.deepseek/disable",
      { method: "POST" },
    )
    const inactive = (await disabled.json()) as { enabled: boolean }

    expect(enabled.status).toBe(200)
    expect(active.enabled).toBe(true)
    expect(disabled.status).toBe(200)
    expect(inactive.enabled).toBe(false)
  })

  test("installs and uninstalls a capability", async () => {
    await using _ = await isolate()
    const uninstalled = await MarketplaceRoutes().request(
      "http://railwise.test/capabilities/railwise.mcp.feishu/uninstall",
      { method: "POST" },
    )
    const inactive = (await uninstalled.json()) as { installed: boolean; enabled: boolean }
    const rejected = await MarketplaceRoutes().request("http://railwise.test/capabilities/railwise.mcp.feishu/enable", {
      method: "POST",
    })
    const installed = await MarketplaceRoutes().request("http://railwise.test/capabilities/railwise.mcp.feishu/install", {
      method: "POST",
    })
    const active = (await installed.json()) as { installed: boolean; enabled: boolean }

    expect(uninstalled.status).toBe(200)
    expect(inactive.installed).toBe(false)
    expect(inactive.enabled).toBe(false)
    expect(rejected.status).toBe(409)
    expect(installed.status).toBe(200)
    expect(active.installed).toBe(true)
    expect(active.enabled).toBe(false)
  })
})
