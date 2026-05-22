import { describe, expect, test } from "bun:test"
import { Marketplace } from "../../src/marketplace"

describe("Marketplace service", () => {
  test("lists built-in RAILWISE capabilities with permission metadata", () => {
    const list = Marketplace.list()

    expect(list.length).toBeGreaterThan(0)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
    expect(list.every((item) => item.permissions)).toBe(true)
  })

  test("groups capabilities by product category", () => {
    const groups = Marketplace.groups(Marketplace.list())

    expect(groups.map((group) => group.kind)).toContain("agent")
    expect(groups.map((group) => group.kind)).toContain("tool")
    expect(groups.map((group) => group.kind)).toContain("skill")
  })

  test("can enable and disable installed capabilities", () => {
    expect(Marketplace.set("railwise.provider.deepseek", true)?.enabled).toBe(true)
    expect(Marketplace.get("railwise.provider.deepseek")?.enabled).toBe(true)
    expect(Marketplace.set("railwise.provider.deepseek", false)?.enabled).toBe(false)
  })
})
