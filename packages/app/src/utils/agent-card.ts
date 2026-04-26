import type { AgentMode } from "@/types/agent-studio"

export function modeLabel(mode: AgentMode) {
  if (mode === "primary") return "主智能体"
  if (mode === "subagent") return "子智能体"
  return "通用"
}
