import { afterEach, describe, expect, test } from "bun:test"
import { Marketplace } from "../../src/marketplace"

afterEach(() => Marketplace.reset())

describe("Marketplace service", () => {
  test("lists built-in RAILWISE capabilities with permission metadata", () => {
    const list = Marketplace.builtins()

    expect(list.length).toBeGreaterThan(0)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
    expect(list.every((item) => item.permissions)).toBe(true)
  })

  test("groups capabilities by product category", () => {
    const groups = Marketplace.groups(Marketplace.builtins())

    expect(groups.map((group) => group.kind)).toContain("agent")
    expect(groups.map((group) => group.kind)).toContain("tool")
    expect(groups.map((group) => group.kind)).toContain("skill")
  })

  test("keeps runtime enablement visible through list and get", () => {
    const enabled = Marketplace.setEnabled("railwise.mcp.local_tools", true)

    expect(enabled?.enabled).toBe(true)
    expect(Marketplace.get("railwise.mcp.local_tools")?.enabled).toBe(true)
    expect(Marketplace.list().find((item) => item.id === "railwise.mcp.local_tools")?.enabled).toBe(true)

    const disabled = Marketplace.setEnabled("railwise.mcp.local_tools", false)

    expect(disabled?.enabled).toBe(false)
    expect(Marketplace.get("railwise.mcp.local_tools")?.enabled).toBe(false)
  })
})
