import { describe, expect, test } from "bun:test"
import { Marketplace } from "../../src/marketplace"

describe("Marketplace service", () => {
  test("lists built-in RAILWISE capabilities with permission metadata", () => {
    const list = Marketplace.builtins()

    expect(list.length).toBeGreaterThan(0)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
    expect(list.every((item) => item.permissions)).toBe(true)
    expect(list.filter((item) => item.kind === "agent")).toHaveLength(12)
    expect(list.filter((item) => item.kind === "skill")).toHaveLength(28)
    expect(list.some((item) => item.id === "railwise.provider.openrouter")).toBe(true)
    expect(list.some((item) => item.name === "项目总控")).toBe(false)
  })

  test("groups capabilities by product category", () => {
    const groups = Marketplace.groups(Marketplace.builtins())

    expect(groups.map((group) => group.kind)).toContain("agent")
    expect(groups.map((group) => group.kind)).toContain("tool")
    expect(groups.map((group) => group.kind)).toContain("skill")
  })

  test("syncs runtime tool registry into marketplace list", async () => {
    const list = await Marketplace.list()

    expect(list.some((item) => item.id === "railwise.tool.bash")).toBe(true)
    expect(list.some((item) => item.id === "railwise.tool.read")).toBe(true)
    expect(list.some((item) => item.id === "railwise.tool.survey_calculator_leveling_closure")).toBe(true)
    expect(list.filter((item) => item.kind === "tool").length).toBeGreaterThan(Marketplace.builtins().filter((item) => item.kind === "tool").length)
  })
})
