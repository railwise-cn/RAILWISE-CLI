import { describe, expect, test } from "bun:test"
import type { CapabilityManifest } from "@railwise/sdk/v2/client"
import {
  agentCapabilityLabels,
  capabilityBindings,
  capabilitiesFor,
  capabilitiesForAgent,
  capabilityCount,
  normalizeCapability,
  capabilityPreview,
  normalizeCapabilities,
  permissionSummary,
  riskLabel,
} from "./marketplace-state"

const list: CapabilityManifest[] = [
  {
    id: "railwise.agent.chief_manager",
    kind: "agent",
    name: "RAILWISE 默认协作",
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
  {
    id: "railwise.skill.standard-reference",
    kind: "skill",
    name: "规范条文速查",
    description: "规范条文速查。",
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
    tags: ["规范"],
  },
]

describe("marketplace capability state", () => {
  test("groups manifests by marketplace category", () => {
    expect(capabilityCount(list, "agents")).toBe(1)
    expect(capabilityCount(list, "providers")).toBe(1)
    expect(capabilityCount(list, "tools")).toBe(0)
    expect(capabilitiesFor(list, "agents")[0]?.name).toBe("RAILWISE 默认协作")
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

  test("maps professional skills to visible agent and workflow bindings", () => {
    expect(capabilityBindings(list[2])).toEqual({
      agents: ["规范资料管理员", "质量审查专家", "CPIII 测量专家"],
      workflows: ["规范引用复核"],
    })
  })

  test("maps agents back to callable capabilities", () => {
    expect(agentCapabilityLabels({ name: "qa_reviewer" })).toContain("质量审查专家")
    expect(capabilitiesForAgent(list, { name: "qa_reviewer" }).map((item) => item.name)).toEqual(["规范条文速查"])
    expect(capabilitiesForAgent(list, { name: "chief_manager" }).map((item) => item.name)).toEqual(["规范条文速查"])
  })

  test("normalizes server and sdk capability response shapes", () => {
    expect(normalizeCapabilities(list)).toHaveLength(3)
    expect(normalizeCapabilities({ data: list })).toHaveLength(3)
    expect(normalizeCapabilities({ data: { data: list } })).toHaveLength(3)
    expect(normalizeCapabilities({ data: null })).toEqual([])
    expect(normalizeCapability(list[0])?.id).toBe("railwise.agent.chief_manager")
    expect(normalizeCapability({ data: list[1] })?.id).toBe("railwise.provider.deepseek")
    expect(normalizeCapability({ data: { data: list[1] } })?.id).toBe("railwise.provider.deepseek")
  })
})
