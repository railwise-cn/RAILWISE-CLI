export type WorkbenchAction = {
  hasWorkspace: boolean
  hasPrompt?: boolean
  hasModel?: boolean
}

export type WorkspaceProject = {
  worktree: string
  time: {
    created: number
    updated?: number
  }
}

export type WorkspaceSession = {
  id: string
  title?: string
  parentID?: string
  time: {
    created: number
    updated?: number
    archived?: number
  }
}

export const defaultAgent = "chief_manager"
export const defaultModel = "DeepSeek V4"

export const promptExamples = [
  "检查当前线路复测资料，列出缺失文件并给出下一步计划。",
  "读取本目录的观测数据，判断是否具备平差计算条件。",
  "根据现有资料整理一份交付物清单和质量风险说明。",
] as const

export function emptyPrompt(input: Pick<WorkbenchAction, "hasWorkspace" | "hasModel">) {
  if (!input.hasWorkspace) return "选择资料目录后，RAILWISE 会加载可用智能体、Skills 与工具。"
  if (!input.hasModel) return "模型尚未接入，仍可先用本地资料检查流程。"
  return "描述你要完成的工程任务，Harness 会规划、调度并记录执行过程。"
}

export function primaryActionLabel(input: Pick<WorkbenchAction, "hasWorkspace">) {
  if (!input.hasWorkspace) return "选择资料目录"
  return "开始会话"
}

export function shouldShowZeroCounter() {
  return false
}

export function compactPath(input: { value: string; home?: string }) {
  if (!input.value) return ""
  if (!input.home) return input.value
  if (input.value === input.home) return "~"
  if (input.value.startsWith(`${input.home}/`)) return `~${input.value.slice(input.home.length)}`
  return input.value
}

export function recentWorkspaces(projects: WorkspaceProject[], limit = 5) {
  const seen = new Set<string>()
  return projects
    .map((project) => ({
      ...project,
      worktree: project.worktree.trim().replaceAll("\\", "/").replace(/\/+$/, ""),
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

export function recentSessions(sessions: WorkspaceSession[], limit = 4) {
  return sessions
    .filter((session) => !session.parentID && !session.time.archived)
    .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
    .slice(0, limit)
}

export function sessionTitle(session: Pick<WorkspaceSession, "title">) {
  return session.title?.trim() || "未命名会话"
}
