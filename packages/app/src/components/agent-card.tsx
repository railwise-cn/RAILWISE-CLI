import { A } from "@solidjs/router"
import type { AgentStudioItem } from "@/types/agent-studio"
import { shortDescription } from "@/utils/agent-markdown"
import { agentColor } from "@/utils/agent"
import { modeLabel } from "@/utils/agent-card"
import { agentDescription, agentDisplayName } from "@/utils/agent-display"
export { modeLabel }

export function AgentCard(props: { agent: AgentStudioItem }) {
  const name = () => agentDisplayName(props.agent)
  const calls = () => props.agent.callCount7d ?? 0
  return (
    <A
      href={`/agents/${props.agent.name}`}
      class="agent-card"
      data-testid={`agent-card-${props.agent.name}`}
      aria-label={`打开 ${name()}`}
    >
      <div class="agent-card__top">
        <div class="agent-card__mark" style={{ "background-color": agentColor(props.agent.name, props.agent.color) }} />
        <div class="agent-card__title">
          <h2>{name()}</h2>
          <span>
            {modeLabel(props.agent.mode)}
          </span>
        </div>
      </div>
      <p>{shortDescription(agentDescription(props.agent) || "暂无描述")}</p>
      <div class="agent-card__meta">
        <span>{props.agent.native ? "内置" : "项目"}</span>
        <span>{props.agent.filePath ? ".railwise/agent" : "默认配置"}</span>
        <span>{calls() > 0 ? `${calls()} 次 / 7 天` : "待使用"}</span>
      </div>
    </A>
  )
}
