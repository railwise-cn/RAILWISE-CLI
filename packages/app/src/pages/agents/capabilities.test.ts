import { describe, expect, test } from "bun:test"
import type { CapabilityManifest } from "@railwise/sdk/v2"
import { effectiveCapabilities, starterCapabilities, toggleStarterCapability, updateStarterCapability } from "./capabilities"

describe("starter capabilities", () => {
  test("keeps the Desktop workbench useful before Marketplace API syncs", () => {
    const list = effectiveCapabilities([])

    expect(list.length).toBeGreaterThan(10)
    expect(list.filter((item) => item.kind === "agent").length).toBeGreaterThanOrEqual(8)
    expect(list.some((item) => item.kind === "tool")).toBe(true)
    expect(list.some((item) => item.kind === "skill")).toBe(true)
    expect(list.some((item) => item.kind === "provider" && item.id === "railwise.provider.deepseek")).toBe(true)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
  })

  test("uses remote Marketplace data when it is available", () => {
    const remote: CapabilityManifest[] = [
      {
        id: "railwise.agent.remote",
        kind: "agent",
        name: "远程智能体",
        description: "server result",
        version: "1.0.0",
        source: "remote",
        enabled: true,
        installed: true,
        permissions: {
          filesystem: "none",
          network: false,
          shell: false,
          external_directory: false,
          secrets: false,
        },
        tags: [],
      },
    ]

    expect(effectiveCapabilities(remote)).toBe(remote)
  })

  test("can toggle local starter state while the server is unavailable", () => {
    const current = toggleStarterCapability(starterCapabilities, "railwise.provider.deepseek", true)

    expect(current.find((item) => item.id === "railwise.provider.deepseek")?.enabled).toBe(true)
    expect(starterCapabilities.find((item) => item.id === "railwise.provider.deepseek")?.enabled).toBe(false)
  })

  test("keeps local harness profiles mutually exclusive", () => {
    const current = toggleStarterCapability(starterCapabilities, "railwise.harness.delivery", true)

    expect(current.find((item) => item.id === "railwise.harness.delivery")?.enabled).toBe(true)
    expect(current.find((item) => item.id === "railwise.harness.safe")?.enabled).toBe(false)
  })

  test("can update local starter installation state", () => {
    const current = updateStarterCapability(starterCapabilities, "railwise.mcp.feishu", {
      installed: true,
    })

    expect(current.find((item) => item.id === "railwise.mcp.feishu")?.installed).toBe(true)
    expect(starterCapabilities.find((item) => item.id === "railwise.mcp.feishu")?.installed).toBe(false)
  })
})
