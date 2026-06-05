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
    expect(body.data.filter((item: { kind: string }) => item.kind === "skill")).toHaveLength(28)
    expect(body.data.some((item: { id: string }) => item.id === "railwise.skill.operational-monitoring")).toBe(true)
    expect(body.data.some((item: { id: string }) => item.id === "railwise.skill.standard-reference")).toBe(true)
    expect(body.data.some((item: { id: string }) => item.id === "railwise.skill.report-writing")).toBe(true)
  })

  test("server app mounts marketplace capabilities", async () => {
    const response = await Server.App().request("/marketplace/capabilities")
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.some((item: { id: string }) => item.id === "railwise.agent.chief_manager")).toBe(true)
  })

  test("enable and disable persist capability state", async () => {
    const id = "railwise.skill.standard-reference"
    const disabled = await MarketplaceRoutes().request(`http://railwise.test/capabilities/${id}/disable`, { method: "POST" })
    const disabledBody = await disabled.json()
    const listDisabled = await MarketplaceRoutes().request("http://railwise.test/capabilities")
    const listDisabledBody = await listDisabled.json()

    expect(disabled.status).toBe(200)
    expect(disabledBody.enabled).toBe(false)
    expect(listDisabledBody.data.find((item: { id: string }) => item.id === id).enabled).toBe(false)

    const enabled = await MarketplaceRoutes().request(`http://railwise.test/capabilities/${id}/enable`, { method: "POST" })
    const enabledBody = await enabled.json()
    const listEnabled = await MarketplaceRoutes().request("http://railwise.test/capabilities")
    const listEnabledBody = await listEnabled.json()

    expect(enabled.status).toBe(200)
    expect(enabledBody.enabled).toBe(true)
    expect(listEnabledBody.data.find((item: { id: string }) => item.id === id).enabled).toBe(true)
  })
})
