export const PROJECT_TYPE_LABEL = {
  metro: "地铁区间",
  excavation: "基坑",
  bridge: "桥梁",
  slope: "边坡",
  highrise: "高层建筑",
} as const

export type ProjectType = keyof typeof PROJECT_TYPE_LABEL
export type ProjectStatus = "active" | "completed" | "paused" | "error"

export type ProjectCard = {
  id: string
  name: string
  type: ProjectType
  status: ProjectStatus
  progress: number
  lastActivity: string
  activeTaskCount: number
  description?: string
  pointCount: number
  alertCount: number
  bboxJson?: string
}

export type Alert = {
  id: string
  projectId: string
  pointId?: string
  level: "warn" | "error"
  message: string
  time: string
}

export type SessionBrief = {
  id: string
  directory: string
  title: string
  time: {
    updated: number
  }
}

export type ActiveAgent = {
  sessionId: string
  agentName: string
  startedAt: string
  status: "running" | "waiting" | "error"
}

export type DashboardSummary = {
  projects: ProjectCard[]
  alerts: Alert[]
  recentSessions: SessionBrief[]
  activeAgents: ActiveAgent[]
}
