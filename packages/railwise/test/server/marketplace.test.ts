import { describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"
import { Log } from "../../src/util/log"

Log.init({ print: false })

describe("server.routes.marketplace", () => {
  test("returns built-in capabilities", async () => {
    const capabilities = await Server.App().request("http://railwise.test/marketplace/capabilities")
    const body = (await capabilities.json()) as { data: { id: string; kind: string; name: string }[] }

    expect(capabilities.status).toBe(200)
    expect(body.data.length).toBeGreaterThan(0)
    expect(body.data.filter((item) => item.kind === "agent").length).toBeGreaterThanOrEqual(12)
    expect(body.data.filter((item) => item.kind === "skill").length).toBe(28)
    expect(body.data.some((item) => item.id === "railwise.provider.deepseek")).toBe(true)
    expect(body.data.some((item) => item.id === "railwise.provider.openrouter")).toBe(true)
    expect(body.data.some((item) => item.name === "项目总控")).toBe(false)
  })
})
