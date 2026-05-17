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
