import { describe, expect, test } from "bun:test"
import { MarketplaceRoutes } from "../../src/server/routes/marketplace"

describe("server.routes.marketplace", () => {
  test("lists Harness marketplace capabilities", async () => {
    const response = await MarketplaceRoutes().request("http://railwise.test/capabilities")
    const body = (await response.json()) as { data: { id: string; permissions: object }[] }

    expect(response.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.some((item) => item.id === "railwise.harness.safe")).toBe(true)
    expect(body.data.every((item) => item.permissions)).toBe(true)
  })

  test("enables and disables a capability", async () => {
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
})
