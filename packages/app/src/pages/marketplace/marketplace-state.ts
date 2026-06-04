import type { CapabilityManifest, CapabilityPermission } from "@railwise/sdk/v2/client"

export const marketplaceIds = ["agents", "tools", "skills", "workflows", "mcp", "providers", "harness"] as const

export type MarketplaceId = (typeof marketplaceIds)[number]

const kinds: Record<MarketplaceId, CapabilityManifest["kind"][]> = {
  agents: ["agent"],
  tools: ["tool"],
  skills: ["skill"],
  workflows: ["workflow"],
  mcp: ["mcp"],
  providers: ["provider"],
  harness: ["harness_profile"],
}

export function capabilitiesFor(list: CapabilityManifest[], id: MarketplaceId) {
  return list.filter((item) => kinds[id].includes(item.kind))
}

function data(value: unknown) {
  if (!value || typeof value !== "object") return
  if (!("data" in value)) return
  return value.data
}

export function normalizeCapabilities(value: unknown): CapabilityManifest[] {
  if (Array.isArray(value)) return value as CapabilityManifest[]

  const body = data(value)
  if (Array.isArray(body)) return body as CapabilityManifest[]

  const nested = data(body)
  if (Array.isArray(nested)) return nested as CapabilityManifest[]

  return []
}

export function capabilityCount(list: CapabilityManifest[], id: MarketplaceId) {
  return capabilitiesFor(list, id).length
}

export function permissionSummary(permission: CapabilityPermission) {
  const items = [
    permission.filesystem === "read" ? "文件读取" : undefined,
    permission.filesystem === "write" ? "文件写入" : undefined,
    permission.network ? "网络" : undefined,
    permission.shell ? "命令" : undefined,
    permission.external_directory ? "外部目录" : undefined,
    permission.secrets ? "密钥" : undefined,
  ].filter((item): item is string => Boolean(item))

  if (items.length === 0) return "无需额外权限"
  return items.join(" / ")
}

export function riskLabel(permission: CapabilityPermission) {
  if (permission.shell || permission.secrets || permission.filesystem === "write") return "高风险"
  if (permission.network || permission.external_directory) return "中风险"
  return "低风险"
}

export function sourceLabel(source: CapabilityManifest["source"]) {
  if (source === "builtin") return "内置"
  if (source === "local") return "本地"
  return "远程"
}

export function capabilityPreview(list: CapabilityManifest[], id: MarketplaceId) {
  return capabilitiesFor(list, id).map((item) => ({
    title: item.name,
    meta: permissionSummary(item.permissions) + " · " + sourceLabel(item.source) + " · " + riskLabel(item.permissions),
  }))
}
