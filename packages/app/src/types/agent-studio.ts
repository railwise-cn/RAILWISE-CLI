export type AgentMode = "subagent" | "primary" | "all"

export type AgentModel = {
  providerID: string
  modelID: string
}

export type AgentStudioItem = {
  name: string
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

export type WorkflowRun = {
  sessionId: string
  sessionTitle?: string
  workflowId?: string
  directory: string
  prompt: string
  agentNames?: string[]
}

export type WorkflowCheck = {
  workflowId: string
  ok: boolean
  generatedAt: string
  checks: {
    id: string
    label: string
    status: "ok" | "warn" | "fail"
    detail: string
  }[]
}

export type FormatSampleReport = {
  id: string
  label: string
  sourceFormat: string
  expectedFormat: string
  detectedFormat: string
  ready: boolean
  damaged?: boolean
  warningCount: number
  warningLines: number[]
  warnings: string[]
  pointCount: number
  observationCount: number
  equationCount: number
  unknowns: string[]
  equationNames: string[]
  nextTool?: string
}

export type FormatCoverageReport = {
  generatedAt: string
  sampleCount: number
  readyCount: number
  formatCount: number
  coveredFormatCount: number
  warningCount: number
  samples: FormatSampleReport[]
  artifacts?: {
    markdownPath: string
    absoluteMarkdownPath: string
    jsonPath: string
    absoluteJsonPath: string
  }
}

export type WikiReport = {
  path: string
  absolutePath: string
  kind: "lint" | "diff" | "format" | "other"
  title: string
  generatedAt?: string
  status?: string
  problemCount?: number
  changeCount?: number
  sampleCount?: number
  readyCount?: number
  formatCount?: number
  coveredFormatCount?: number
  warningCount?: number
  jsonPath?: string
  updatedAt: string
}

export type WikiLogEntry = {
  kind: "query" | "ingest" | "other"
  timestamp?: string
  title: string
  paths: string[]
  raw: string
}

export type WikiStatus = {
  root: string
  readonly: boolean
  pageCount: number
  rawCount: number
  indexPath?: string
  reportCount: number
  reports: WikiReport[]
  logCount: number
  logs: WikiLogEntry[]
}

export type WikiReportDetail = WikiReport & {
  rawMarkdown: string
}
