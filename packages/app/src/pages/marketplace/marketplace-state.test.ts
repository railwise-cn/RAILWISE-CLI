import { describe, expect, test } from "bun:test"
import {
  actionLabel,
  capabilityRisk,
  capabilityRiskLabel,
  filterCapabilities,
  groupCapabilities,
  permissionLabels,
  sourceLabel,
  type Capability,
} from "./marketplace-state"

const base: Capability = {
  id: "railwise.tool.file_reader",
  kind: "tool",
  name: "文件读取",
  description: "读取工程资料。",
  version: "1.0.0",
  source: "builtin",
  enabled: true,
  installed: true,
  permissions: { filesystem: "read" },
  tags: ["survey"],
}

describe("marketplace state", () => {
  test("groups capabilities by product-facing category order", () => {
    const groups = groupCapabilities([
      { ...base, id: "provider", kind: "provider", name: "DeepSeek", permissions: { network: true } },
      { ...base, id: "agent", kind: "agent", name: "主控智能体" },
    ])

    expect(groups.map((group) => group.kind)).toEqual(["agent", "provider"])
  })

  test("filters by category, name, description, and tags", () => {
    expect(filterCapabilities([base], { query: "survey", kind: "tool" }).map((item) => item.id)).toEqual([
      "railwise.tool.file_reader",
    ])
    expect(filterCapabilities([base], { query: "deepseek", kind: "tool" })).toEqual([])
  })

  test("describes permissions and risk clearly", () => {
    const item = { ...base, permissions: { filesystem: "write" as const, shell: true } }

    expect(permissionLabels(item)).toEqual(["文件写入", "命令执行"])
    expect(capabilityRisk(item)).toBe("high")
    expect(capabilityRiskLabel(item)).toBe("高风险")
  })

  test("labels source and action", () => {
    expect(sourceLabel("builtin")).toBe("内置")
    expect(actionLabel(base)).toBe("停用")
    expect(actionLabel({ ...base, enabled: false })).toBe("启用")
    expect(actionLabel({ ...base, installed: false, enabled: false })).toBe("安装")
  })
})
