import { describe, expect, test } from "bun:test"
import path from "path"
import { Marketplace } from "../../src/marketplace"
import { tmpdir } from "../fixture/fixture"

async function isolate() {
  const tmp = await tmpdir()
  Marketplace.configure(path.join(tmp.path, "marketplace.json"))
  return tmp
}

describe("Marketplace service", () => {
  test("lists built-in RAILWISE capabilities with permission metadata", async () => {
    await using _ = await isolate()
    const list = await Marketplace.list()

    expect(list.length).toBeGreaterThan(0)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
    expect(list.every((item) => item.permissions)).toBe(true)
  })

  test("groups capabilities by product category", async () => {
    await using _ = await isolate()
    const groups = Marketplace.groups(await Marketplace.list())

    expect(groups.map((group) => group.kind)).toContain("agent")
    expect(groups.map((group) => group.kind)).toContain("tool")
    expect(groups.map((group) => group.kind)).toContain("skill")
  })

  test("can enable and disable installed capabilities", async () => {
    await using _ = await isolate()

    expect((await Marketplace.set("railwise.provider.deepseek", true))?.enabled).toBe(true)
    expect((await Marketplace.get("railwise.provider.deepseek"))?.enabled).toBe(true)
    expect((await Marketplace.set("railwise.provider.deepseek", false))?.enabled).toBe(false)
  })

  test("persists enabled choices across service reloads", async () => {
    await using tmp = await isolate()
    const file = path.join(tmp.path, "marketplace.json")

    await Marketplace.set("railwise.provider.deepseek", true)
    Marketplace.configure(file)

    expect((await Marketplace.get("railwise.provider.deepseek"))?.enabled).toBe(true)
  })
})
