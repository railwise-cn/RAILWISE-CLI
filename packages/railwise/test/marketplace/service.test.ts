import { afterEach, describe, expect, test } from "bun:test"
import path from "path"
import { Global } from "../../src/global"
import { Marketplace } from "../../src/marketplace"
import { Filesystem } from "../../src/util/filesystem"

afterEach(async () => {
  await Marketplace.reset()
})

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

  test("keeps runtime enablement visible through list and get", async () => {
    const enabled = await Marketplace.setEnabled("railwise.mcp.local_tools", true)

    expect(enabled?.enabled).toBe(true)
    expect(Marketplace.get("railwise.mcp.local_tools")?.enabled).toBe(true)
    expect(Marketplace.list().find((item) => item.id === "railwise.mcp.local_tools")?.enabled).toBe(true)

    const disabled = await Marketplace.setEnabled("railwise.mcp.local_tools", false)

    expect(disabled?.enabled).toBe(false)
    expect(Marketplace.get("railwise.mcp.local_tools")?.enabled).toBe(false)
  })

  test("restores enablement from the local marketplace state file", async () => {
    await Filesystem.writeJson(path.join(Global.Path.state, "marketplace.json"), {
      enabled: {
        "railwise.mcp.local_tools": true,
      },
    })

    await Marketplace.reload()

    expect(Marketplace.get("railwise.mcp.local_tools")?.enabled).toBe(true)
  })
})
