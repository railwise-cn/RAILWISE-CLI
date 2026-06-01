import type { HarnessTimelineResponse } from "@railwise/sdk/v2/client"

export type HarnessEvent = HarnessTimelineResponse["data"][number]

const typeLabel: Record<HarnessEvent["type"], string> = {
  "session.started": "会话开始",
  "plan.created": "计划生成",
  "agent.selected": "智能体选择",
  "model.selected": "模型选择",
  "skill.loaded": "Skill 加载",
  "tool.requested": "工具请求",
  "permission.requested": "权限请求",
  "permission.resolved": "权限处理",
  "tool.started": "工具开始",
  "tool.completed": "工具完成",
  "tool.failed": "工具失败",
  "artifact.created": "产物生成",
  "session.completed": "会话完成",
}

const riskLabel: Record<NonNullable<HarnessEvent["risk"]>, string> = {
  low: "低风险",
  medium: "需注意",
  high: "高风险",
}

export function harnessEventTypeLabel(type: HarnessEvent["type"]) {
  return typeLabel[type]
}

export function harnessRiskLabel(risk: HarnessEvent["risk"] = "low") {
  return riskLabel[risk]
}

export function formatDuration(value?: number) {
  if (value === undefined) return ""
  if (value < 1000) return `${value}ms`
  return `${(value / 1000).toFixed(1)}s`
}

export function timelineRows(events: HarnessEvent[]) {
  return events
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt)
    .map((event) => ({
      event,
      type: harnessEventTypeLabel(event.type),
      risk: harnessRiskLabel(event.risk),
      duration: formatDuration(event.duration),
    }))
}
