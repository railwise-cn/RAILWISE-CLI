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

export function normalizeCapability(value: unknown): CapabilityManifest | undefined {
  if (!value || typeof value !== "object") return
  if ("kind" in value && "id" in value) return value as CapabilityManifest
  const body = data(value)
  if (body && typeof body === "object" && "kind" in body && "id" in body) return body as CapabilityManifest
  return normalizeCapability(body)
}

export function capabilityCount(list: CapabilityManifest[], id: MarketplaceId) {
  return capabilitiesFor(list, id).length
}

const bindings: Record<string, { agents: string[]; workflows: string[] }> = {
  "railwise.tool.task": {
    agents: ["RAILWISE 协作"],
    workflows: ["任务拆解与调度"],
  },
  "railwise.tool.skill": {
    agents: ["RAILWISE 协作"],
    workflows: ["按任务加载 Skill"],
  },
  "railwise.tool.file_reader": {
    agents: ["RAILWISE 协作", "资料入库专员", "报告编制员"],
    workflows: ["本地资料读取"],
  },
  "railwise.tool.standard_query_query_standard": {
    agents: ["规范资料管理员", "质量审查专家", "CPIII 测量专家"],
    workflows: ["规范引用复核"],
  },
  "railwise.tool.survey_calculator_leveling_closure": {
    agents: ["外业数据首检员", "严密平差计算专家", "数据分析工程师"],
    workflows: ["数据首检与趋势分析"],
  },
  "railwise.tool.resurvey_material_check": {
    agents: ["外业数据首检员", "资料入库专员", "质量审查专家"],
    workflows: ["复测资料检查"],
  },
  "railwise.tool.monitoring_data_first_check": {
    agents: ["外业数据首检员", "数据分析工程师", "质量审查专家"],
    workflows: ["运营监测分析"],
  },
  "railwise.tool.dxf_layer_inspector": {
    agents: ["方案架构师", "资料入库专员", "质量审查专家"],
    workflows: ["图纸资料检查"],
  },
  "railwise.tool.xlsx_quality_checker": {
    agents: ["外业数据首检员", "数据分析工程师"],
    workflows: ["数据表格整理"],
  },
  "railwise.tool.docx_report_formatter": {
    agents: ["报告编制员", "质量审查专家"],
    workflows: ["成果报告编制"],
  },
  "railwise.tool.pptx_brief_builder": {
    agents: ["报告编制员", "方案架构师"],
    workflows: ["阶段汇报生成"],
  },
  "railwise.tool.pdf_form_checker": {
    agents: ["资料入库专员", "报告编制员"],
    workflows: ["PDF 资料检查"],
  },
  "railwise.skill.rail-monitoring-plan": {
    agents: ["方案架构师", "CPIII 测量专家", "规范资料管理员"],
    workflows: ["监测方案编制"],
  },
  "railwise.skill.monitoring-design": {
    agents: ["方案架构师", "质量审查专家"],
    workflows: ["监测方案编制"],
  },
  "railwise.skill.operational-monitoring": {
    agents: ["数据分析工程师", "报告编制员", "质量审查专家"],
    workflows: ["运营监测分析"],
  },
  "railwise.skill.data-analysis": {
    agents: ["数据分析工程师", "严密平差计算专家", "外业数据首检员"],
    workflows: ["数据首检与趋势分析"],
  },
  "railwise.skill.standard-reference": {
    agents: ["规范资料管理员", "质量审查专家", "CPIII 测量专家"],
    workflows: ["规范引用复核"],
  },
  "railwise.skill.report-writing": {
    agents: ["报告编制员", "质量审查专家"],
    workflows: ["成果报告编制"],
  },
  "railwise.skill.excel-operations": {
    agents: ["外业数据首检员", "数据分析工程师"],
    workflows: ["数据表格整理"],
  },
  "railwise.skill.docx-generation": {
    agents: ["报告编制员"],
    workflows: ["Word 成果生成"],
  },
  "railwise.skill.docx": {
    agents: ["报告编制员"],
    workflows: ["Word 成果生成"],
  },
  "railwise.skill.pptx": {
    agents: ["报告编制员", "方案架构师"],
    workflows: ["阶段汇报生成"],
  },
  "railwise.skill.pdf": {
    agents: ["资料入库专员", "报告编制员"],
    workflows: ["PDF 资料检查"],
  },
  "railwise.skill.xlsx": {
    agents: ["外业数据首检员", "数据分析工程师"],
    workflows: ["XLSX 数据处理"],
  },
  "railwise.skill.bidding-knowledge": {
    agents: ["商务及招投标专家", "报告编制员"],
    workflows: ["投标文件响应"],
  },
  "railwise.skill.frontend-design": {
    agents: ["方案架构师", "报告编制员"],
    workflows: ["可视化交付"],
  },
  "railwise.skill.canvas-design": {
    agents: ["方案架构师", "报告编制员"],
    workflows: ["可视化交付"],
  },
  "railwise.skill.humanizer": {
    agents: ["报告编制员", "质量审查专家"],
    workflows: ["文稿润色审校"],
  },
  "railwise.skill.doc-coauthoring": {
    agents: ["知识库整理员", "报告编制员"],
    workflows: ["文档协同审阅"],
  },
  "railwise.skill.internal-comms": {
    agents: ["知识库整理员", "报告编制员"],
    workflows: ["文档协同审阅"],
  },
  "railwise.skill.brand-guidelines": {
    agents: ["报告编制员", "方案架构师"],
    workflows: ["品牌规范套用"],
  },
  "railwise.skill.theme-factory": {
    agents: ["报告编制员", "方案架构师"],
    workflows: ["可视化交付"],
  },
  "railwise.skill.web-artifacts-builder": {
    agents: ["方案架构师"],
    workflows: ["交互原型构建"],
  },
  "railwise.skill.webapp-testing": {
    agents: ["质量审查专家", "方案架构师"],
    workflows: ["Web 应用验收"],
  },
  "railwise.skill.bun-file-io": {
    agents: ["知识库整理员", "资料入库专员"],
    workflows: ["本地资料处理"],
  },
  "railwise.skill.mcp-builder": {
    agents: ["知识库整理员", "方案架构师"],
    workflows: ["MCP 工具接入"],
  },
  "railwise.skill.skill-creator": {
    agents: ["知识库整理员", "质量审查专家"],
    workflows: ["专业 Skill 创建"],
  },
  "railwise.skill.claude-api": {
    agents: ["方案架构师"],
    workflows: ["模型接口开发"],
  },
  "railwise.skill.algorithmic-art": {
    agents: ["报告编制员"],
    workflows: ["可视化素材生成"],
  },
  "railwise.skill.slack-gif-creator": {
    agents: ["报告编制员"],
    workflows: ["内部沟通素材"],
  },
}

export function capabilityBindings(item: CapabilityManifest) {
  if (bindings[item.id]) return bindings[item.id]
  if (item.kind === "tool") return { agents: ["RAILWISE 协作"], workflows: ["按任务调度"] }
  if (item.kind === "workflow") return { agents: ["RAILWISE 协作"], workflows: ["工作流编排"] }
  if (item.kind === "skill") return { agents: ["RAILWISE 协作"], workflows: ["扩展能力构建"] }
  return { agents: [], workflows: [] }
}

type AgentBindingInput = {
  name: string
  displayName?: string
}

type RoutingPart = {
  type: string
  text?: string
  synthetic?: boolean
}

const agentLabels: Record<string, string[]> = {
  chief_manager: ["RAILWISE", "RAILWISE 协作"],
  cpiii_specialist: ["CPIII 测量专家", "CPIII 专家"],
  data_analyst: ["数据分析工程师", "数据分析"],
  qa_inspector: ["外业数据首检员", "数据质检"],
  qa_reviewer: ["质量审查专家", "质量审查"],
  norm_librarian: ["规范资料管理员", "规范检索"],
  technical_writer: ["报告编制员", "报告编制"],
  writer: ["报告编制员", "报告编制"],
  solution_architect: ["方案架构师", "方案架构"],
  commercial_specialist: ["商务及招投标专家", "投标商务"],
  knowledge_curator: ["知识库整理员", "知识整理"],
  source_ingestor: ["资料入库专员", "资料导入"],
  adjustment_computer: ["严密平差计算专家", "平差计算"],
  ppt_master: ["报告编制员", "汇报生成"],
}

const routedKinds = new Set<CapabilityManifest["kind"]>(["tool", "skill", "workflow"])
const skillOrder = [
  "rail-monitoring-plan",
  "monitoring-design",
  "operational-monitoring",
  "data-analysis",
  "standard-reference",
  "report-writing",
  "excel-operations",
  "docx-generation",
  "docx",
  "pptx",
  "pdf",
  "xlsx",
  "bidding-knowledge",
  "frontend-design",
  "canvas-design",
  "humanizer",
  "doc-coauthoring",
  "internal-comms",
  "brand-guidelines",
  "theme-factory",
  "web-artifacts-builder",
  "webapp-testing",
  "bun-file-io",
  "mcp-builder",
  "skill-creator",
  "claude-api",
  "algorithmic-art",
  "slack-gif-creator",
]
const toolOrder = [
  "task",
  "skill",
  "file_reader",
  "standard_query_query_standard",
  "survey_calculator_leveling_closure",
  "resurvey_material_check",
  "monitoring_data_first_check",
  "dxf_layer_inspector",
  "xlsx_quality_checker",
  "docx_report_formatter",
  "pptx_brief_builder",
  "pdf_form_checker",
]
const kindOrder: Record<CapabilityManifest["kind"], number> = {
  skill: 0,
  tool: 1,
  workflow: 2,
  agent: 3,
  mcp: 4,
  provider: 5,
  harness_profile: 6,
}

export function agentCapabilityLabels(agent?: AgentBindingInput | null) {
  if (!agent) return []
  return Array.from(new Set([...(agentLabels[agent.name] ?? []), agent.displayName?.trim(), agent.name.replaceAll("_", " ")]).values()).filter(
    (item): item is string => Boolean(item),
  )
}

function capabilityRank(item: CapabilityManifest) {
  if (item.kind === "skill") {
    const id = item.id.replace("railwise.skill.", "")
    const index = skillOrder.indexOf(id)
    return index >= 0 ? index : skillOrder.length + 100
  }
  if (item.kind === "tool") {
    const id = item.id.replace("railwise.tool.", "")
    const index = toolOrder.indexOf(id)
    return kindOrder[item.kind] * 1000 + (index >= 0 ? index : toolOrder.length + 100)
  }
  return kindOrder[item.kind] * 1000
}

export function capabilitiesForAgent(list: CapabilityManifest[], agent?: AgentBindingInput | null) {
  if (!agent) return []
  const labels = new Set(agentCapabilityLabels(agent))
  return list
    .filter((item) => item.enabled && item.installed && routedKinds.has(item.kind))
    .filter((item) => {
      if (agent.name === "chief_manager") return capabilityBindings(item).agents.length > 0
      return capabilityBindings(item).agents.some((label) => labels.has(label))
    })
    .sort((a, b) => capabilityRank(a) - capabilityRank(b) || a.name.localeCompare(b.name, "zh-Hans-CN"))
}

export function capabilitiesForAgents(list: CapabilityManifest[], agents: AgentBindingInput[]) {
  const seen = new Set<string>()
  return agents
    .flatMap((agent) => capabilitiesForAgent(list, agent))
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
}

function routeID(id: string) {
  return id
    .trim()
    .replace(/[.,;:]+$/, "")
    .replace(/^railwise\.(tool|skill|workflow)\./, "")
}

export function capabilitiesFromRouting(list: CapabilityManifest[], parts: RoutingPart[]) {
  const text = parts
    .filter((part) => part.type === "text" && part.synthetic && part.text?.includes("<railwise_routing>"))
    .map((part) => part.text)
    .join("\n")
  if (!text) return []

  const ids = new Set(Array.from(text.matchAll(/^\s*-\s*([a-zA-Z0-9_.:-]+)\s*:/gm)).map((match) => routeID(match[1])))
  const names = new Set(Array.from(text.matchAll(/name="([^"]+)"/g)).map((match) => match[1].trim()))
  const seen = new Set<string>()

  return list
    .filter((item) => item.enabled && item.installed && routedKinds.has(item.kind))
    .filter((item) => ids.has(routeID(item.id)) || names.has(item.name))
    .sort((a, b) => capabilityRank(a) - capabilityRank(b) || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .filter((item) => {
      if (seen.has(item.id)) return false
      seen.add(item.id)
      return true
    })
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
