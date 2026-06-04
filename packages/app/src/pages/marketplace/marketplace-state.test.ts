import { describe, expect, test } from "bun:test"
import type { CapabilityManifest } from "@railwise/sdk/v2/client"
import {
  capabilitiesFor,
  capabilityCount,
  capabilityPreview,
  normalizeCapabilities,
  permissionSummary,
  riskLabel,
} from "./marketplace-state"

const list: CapabilityManifest[] = [
  {
    id: "railwise.agent.chief_manager",
    kind: "agent",
    name: "RAILWISE 协作入口",
    description: "调度专业智能体。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    },
    tags: ["协作"],
  },
  {
    id: "railwise.provider.deepseek",
    kind: "provider",
    name: "DeepSeek",
    description: "默认模型 Provider。",
    version: "0.1.0",
    source: "builtin",
    enabled: false,
    installed: true,
    permissions: {
      filesystem: "none",
      network: true,
      shell: false,
      external_directory: false,
      secrets: true,
    },
    tags: ["模型"],
  },
]

describe("marketplace capability state", () => {
  test("groups manifests by marketplace category", () => {
    expect(capabilityCount(list, "agents")).toBe(1)
    expect(capabilityCount(list, "providers")).toBe(1)
    expect(capabilityCount(list, "tools")).toBe(0)
    expect(capabilitiesFor(list, "agents")[0]?.name).toBe("RAILWISE 协作入口")
  })

  test("summarizes permissions for compact UI chips", () => {
    expect(permissionSummary(list[0].permissions)).toBe("文件读取")
    expect(permissionSummary(list[1].permissions)).toBe("网络 / 密钥")
    expect(riskLabel(list[0].permissions)).toBe("低风险")
    expect(riskLabel(list[1].permissions)).toBe("高风险")
  })

  test("builds manifest previews without depending on dynamic inventory", () => {
    expect(capabilityPreview(list, "providers")).toEqual([
      {
        title: "DeepSeek",
        meta: "网络 / 密钥 · 内置 · 高风险",
      },
    ])
  })

  test("normalizes server and sdk capability response shapes", () => {
    expect(normalizeCapabilities(list)).toHaveLength(2)
    expect(normalizeCapabilities({ data: list })).toHaveLength(2)
    expect(normalizeCapabilities({ data: { data: list } })).toHaveLength(2)
    expect(normalizeCapabilities({ data: null })).toEqual([])
  })
})
