import type { MarketplaceCapabilitiesResponse } from "@railwise/sdk/v2/client"

export type Capability = MarketplaceCapabilitiesResponse["data"][number]
export type CapabilityKind = Capability["kind"] | "all"

export const kinds: Array<{ value: CapabilityKind; label: string }> = [
  { value: "all", label: "全部" },
  { value: "agent", label: "智能体" },
  { value: "tool", label: "工具" },
  { value: "skill", label: "Skills" },
  { value: "workflow", label: "工作流" },
  { value: "mcp", label: "MCP" },
  { value: "provider", label: "模型" },
  { value: "harness_profile", label: "Harness" },
]

const source: Record<Capability["source"], string> = {
  builtin: "内置",
  local: "本地",
  remote: "远程",
}

const risk = {
  low: "低风险",
  medium: "需注意",
  high: "高风险",
} as const

export function sourceLabel(value: Capability["source"]) {
  return source[value]
}

export function permissionLabels(capability: Capability) {
  const permissions = capability.permissions
  return [
    permissions.filesystem === "read" ? "文件读取" : undefined,
    permissions.filesystem === "write" ? "文件写入" : undefined,
    permissions.network ? "网络访问" : undefined,
    permissions.shell ? "命令执行" : undefined,
    permissions.external_directory ? "外部目录" : undefined,
    permissions.secrets ? "密钥访问" : undefined,
  ].filter((label): label is string => Boolean(label))
}

export function capabilityRisk(capability: Capability) {
  const permissions = capability.permissions
  if (permissions.shell || permissions.secrets || permissions.filesystem === "write") return "high" as const
  if (permissions.network || permissions.external_directory) return "medium" as const
  return "low" as const
}

export function capabilityRiskLabel(capability: Capability) {
  return risk[capabilityRisk(capability)]
}

export function actionLabel(capability: Capability) {
  if (!capability.installed) return "安装"
  if (capability.enabled) return "停用"
  return "启用"
}

export function filterCapabilities(items: Capability[], input: { query: string; kind: CapabilityKind }) {
  const query = input.query.trim().toLowerCase()
  return items.filter((item) => {
    const kind = input.kind === "all" || item.kind === input.kind
    const found =
      !query ||
      item.name.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.tags?.some((tag) => tag.toLowerCase().includes(query))
    return kind && found
  })
}

export function groupCapabilities(items: Capability[]) {
  return kinds
    .filter((kind) => kind.value !== "all")
    .map((kind) => ({
      kind: kind.value,
      label: kind.label,
      items: items.filter((item) => item.kind === kind.value),
    }))
    .filter((group) => group.items.length > 0)
}
