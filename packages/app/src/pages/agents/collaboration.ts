import { base64Encode } from "@railwise/util/encode"
import { removeScalar, setScalar } from "@/utils/agent-markdown"

export const recommendedModel = "DeepSeek V4"
export const recommendedProviders = [
  { id: "deepseek", label: "DeepSeek" },
  { id: "openrouter", label: "OpenRouter" },
] as const

export type CollaborationDraft = {
  directory: string
  agent: string
  prompt: string
}

type WorkspaceProject = {
  worktree: string
  time: {
    created: number
    updated?: number
  }
}

type Agent = {
  name: string
  displayName?: string
  mode: "subagent" | "primary" | "all"
  hidden?: boolean
  model?: {
    providerID: string
    modelID: string
  }
}

type Skill = {
  name: string
  description: string
  location: string
}

type Capability = {
  id: string
  kind: string
  name: string
  description: string
  enabled: boolean
}

export type CollaborationPlanItem = {
  kind: "agent" | "skill" | "tool" | "permission"
  label: string
  detail: string
}

const skills = [
  "monitoring-design",
  "data-analysis",
  "standard-reference",
  "report-writing",
  "excel-operations",
  "docx-generation",
  "canvas-design",
  "bidding-knowledge",
  "humanizer",
  "frontend-design",
]

export function agentRoleLabel(agent: Agent) {
  if (agent.mode === "primary") return "主控"
  return "专业智能体"
}

export function agentStudioSummary(agents: Agent[]) {
  const visible = agents.filter((agent) => !agent.hidden)
  const primary = visible.filter((agent) => agent.mode === "primary").length
  return {
    total: visible.length,
    primary,
    collaborators: visible.length - primary,
  }
}

export function collaborationPlan(input: {
  agent?: Agent
  agents: Agent[]
  capabilities: Capability[]
  prompt: string
}): CollaborationPlanItem[] {
  const text = input.prompt.trim()
  const has = (pattern: RegExp) => pattern.test(text)
  const visible = input.agents.filter((agent) => !agent.hidden)
  const capability = input.capabilities.filter((item) => item.enabled)
  const name = (agent?: Agent) => agent?.displayName ?? agent?.name ?? "项目总控"
  const findAgent = (names: string[]) =>
    names.map((item) => visible.find((agent) => agent.name === item)).filter((agent): agent is Agent => Boolean(agent))
  const find = (kind: string, ids: string[], fallback: string[]) => {
    const rows = capability.filter((item) => item.kind === kind)
    const picked = ids
      .map((id) => rows.find((item) => item.id === id))
      .filter((item): item is Capability => Boolean(item))
    if (picked.length) return picked.map((item) => item.name).slice(0, 3)
    return rows
      .map((item) => item.name)
      .filter((item) => fallback.some((word) => item.includes(word)))
      .slice(0, 3)
  }
  const specialists = [
    ...(has(/CPIII|CPⅢ|复测|轨道|控制网|精调/i) ? findAgent(["cpiii_specialist"]) : []),
    ...(has(/CPIII|CPⅢ|复测|平差|粗差|残差|精度|观测/i) ? findAgent(["adjustment_computer"]) : []),
    ...(has(/规范|条文|引用|限差/i) ? findAgent(["railway_norm_consultant", "norm_librarian"]) : []),
    ...(has(/报告|交付|摘要|总结/i) ? findAgent(["technical_writer"]) : []),
    ...(has(/质量|审查|风险|缺失/i) ? findAgent(["qa_reviewer"]) : []),
  ].filter((agent, index, list) => list.findIndex((item) => item.name === agent.name) === index)
  const skills =
    has(/报告|交付|摘要|总结/i) || has(/规范|条文|引用|限差/i)
      ? find("skill", ["railwise.skill.standard_reference", "railwise.skill.report_delivery"], ["规范", "报告"])
      : find("skill", ["railwise.skill.survey_review", "railwise.skill.data_analysis"], ["复测", "平差", "资料"])
  const tools =
    has(/平差|粗差|残差|精度|观测|CPIII|CPⅢ/i) || has(/规范|条文|引用|限差/i)
      ? find("tool", ["railwise.tool.adjustment_indirect", "railwise.tool.wiki_query"], ["平差", "规范", "Wiki"])
      : find("tool", ["railwise.tool.file_reader", "railwise.tool.report_writer"], ["文件", "报告"])
  return [
    {
      kind: "agent",
      label: name(input.agent),
      detail: "接收任务、拆解步骤，并决定是否需要调用专业智能体。",
    },
    {
      kind: "agent",
      label: specialists.length ? specialists.map(name).join("、") : "按任务选择专业智能体",
      detail: specialists.length
        ? "作为子智能体参与资料审查、计算核对和报告生成。"
        : "Harness 会根据任务内容自动选择专业能力。",
    },
    {
      kind: "skill",
      label: skills.length ? skills.join("、") : "按任务加载 Skills",
      detail: "把专业流程约束注入会话，避免只做通用问答。",
    },
    {
      kind: "tool",
      label: tools.length ? tools.join("、") : "按任务调用工具",
      detail: "文件读取、规范查询、平差计算和报告生成都通过权限受控工具执行。",
    },
    {
      kind: "permission",
      label: "询问确认",
      detail: "写文件、访问外部目录、执行命令或使用密钥前进入会话确认。",
    },
  ]
}

function normalizeDirectory(value: string) {
  const clean = value.trim().replaceAll("\\", "/")
  if (clean === "/") return clean
  if (/^[A-Za-z]:\/$/.test(clean)) return clean
  return clean.replace(/\/+$/, "")
}

export function recentWorkspaces(projects: WorkspaceProject[], limit = 4) {
  const seen = new Set<string>()
  return projects
    .map((project) => ({
      ...project,
      worktree: normalizeDirectory(project.worktree),
    }))
    .filter((project) => project.worktree && project.worktree !== "/")
    .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
    .filter((project) => {
      if (seen.has(project.worktree)) return false
      seen.add(project.worktree)
      return true
    })
    .slice(0, limit)
}

function skillRank(skill: Skill) {
  const index = skills.indexOf(skill.name)
  if (index >= 0) return index
  if (skill.location.includes("/.railwise/skill/")) return skills.length
  return skills.length + 1
}

export function professionalSkills(list: Skill[], limit = 12) {
  return list
    .slice()
    .sort((a, b) => skillRank(a) - skillRank(b) || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .slice(0, limit)
}

export function enabledSkillRows(list: Capability[], limit = 8) {
  return list
    .filter((item) => item.kind === "skill" && item.enabled)
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      label: item.name,
      detail: item.description,
    }))
}

export function collaborationTarget(input: CollaborationDraft) {
  const directory = normalizeDirectory(input.directory)
  const key = base64Encode(directory)
  const agent = input.agent.trim()
  const prompt = input.prompt.trim()

  return {
    directory,
    key,
    href: `/${key}/session`,
    prompt: agent ? `@${agent}\n${prompt}` : prompt,
  }
}

export function modelRouteLabel(agent: Agent, fallback = recommendedModel) {
  if (agent.model) return `${agent.model.providerID}/${agent.model.modelID}`
  return `默认 ${fallback}`
}

export function modelRoutingSummary(agents: Agent[]) {
  const visible = agents.filter((agent) => !agent.hidden)
  const bound = visible.filter((agent) => Boolean(agent.model)).length
  return {
    total: visible.length,
    bound,
    defaulted: visible.length - bound,
    recommended: recommendedModel,
  }
}

export function modelSetupState(input: { connectedProviders: number; visibleModels: number }) {
  if (input.visibleModels > 0) return "ready" as const
  if (input.connectedProviders > 0) return "models-hidden" as const
  return "needs-provider" as const
}

export function parseModelRoute(value: string) {
  const route = value.trim()
  const index = route.indexOf("/")
  if (index <= 0 || index === route.length - 1) return
  return {
    providerID: route.slice(0, index),
    modelID: route.slice(index + 1),
  }
}

export function updateAgentModelRoute(raw: string, value: string) {
  const route = value.trim()
  if (!route) return removeScalar(raw, "model")
  return setScalar(raw, "model", route)
}
