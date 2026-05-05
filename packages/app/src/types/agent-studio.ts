export type AgentMode = "subagent" | "primary" | "all"

export type AgentModel = {
  providerID: string
  modelID: string
}

export type AgentStudioItem = {
  name: string
  displayName?: string
  description?: string
  mode: AgentMode
  native?: boolean
  hidden?: boolean
  topP?: number
  temperature?: number
  color?: string
  permission: unknown
  model?: AgentModel
  variant?: string
  prompt?: string
  options: Record<string, unknown>
  steps?: number
  filePath?: string
  callCount7d?: number
}

export type AgentStudioDetail = AgentStudioItem & {
  rawMarkdown: string
}

export type ToolInventoryItem = {
  id: string
  label: string
  group: "agent" | "knowledge" | "survey" | "core" | "extension"
}

export type SkillInventoryItem = {
  name: string
  description: string
  location: string
}

export type WorkflowRun = {
  sessionId: string
  sessionTitle?: string
  workflowId?: string
  agentNames?: string[]
}
