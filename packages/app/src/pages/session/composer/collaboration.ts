type Agent = {
  name: string
  displayName?: string
  description?: string
  mode: "subagent" | "primary" | "all"
  hidden?: boolean
  model?: {
    providerID: string
    modelID: string
  }
}

type Capability = {
  kind: "tool" | "skill"
  name: string
}

export const recommendedModel = "DeepSeek V4"

export function collaborationAgents(agents: Agent[]) {
  return agents
    .filter((agent) => !agent.hidden)
    .sort((a, b) => Number(a.mode !== "primary") - Number(b.mode !== "primary") || a.name.localeCompare(b.name))
}

export function agentMentionPrompt(agent: string, prompt: string) {
  const draft = prompt.trim()
  const mention = `@${agent}`
  if (!draft) return mention
  if (draft.startsWith(mention)) return draft
  return `${mention}\n${draft}`
}

export function capabilityPrompt(capability: Capability, prompt: string) {
  const draft = prompt.trim()
  const line =
    capability.kind === "tool"
      ? `请调用工具「${capability.name}」处理当前任务。`
      : `请使用技能「${capability.name}」执行当前任务。`
  if (!draft) return line
  if (draft.startsWith(line)) return draft
  return `${line}\n${draft}`
}

export function agentModelLabel(agent: Agent, fallback = recommendedModel) {
  if (agent.model) return `${agent.model.providerID}/${agent.model.modelID}`
  return `默认 ${fallback}`
}
