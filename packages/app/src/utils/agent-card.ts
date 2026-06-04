import type { AgentMode } from "@/types/agent-studio"

export function modeLabel(mode: AgentMode) {
  if (mode === "primary") return "协作入口"
  return "专业智能体"
}
