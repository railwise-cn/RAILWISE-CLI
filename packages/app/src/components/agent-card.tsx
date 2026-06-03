import { A } from "@solidjs/router"
import type { AgentStudioItem } from "@/types/agent-studio"
import { shortDescription } from "@/utils/agent-markdown"
import { agentColor } from "@/utils/agent"
import { modeLabel } from "@/utils/agent-card"
import { agentDisplayName } from "@/pages/agents/collaboration"
export { modeLabel }

export function AgentCard(props: { agent: AgentStudioItem }) {
  const title = () => agentDisplayName(props.agent)

  return (
    <A
      href={`/agents/${props.agent.name}`}
      class="agent-card"
      data-testid={`agent-card-${props.agent.name}`}
      aria-label={`打开 ${title()}`}
    >
      <div class="agent-card__top">
        <div class="agent-card__mark" style={{ "background-color": agentColor(props.agent.name, props.agent.color) }} />
        <div class="agent-card__title">
          <h2>{title()}</h2>
          <span>
            {modeLabel(props.agent.mode)} · @{props.agent.name}
          </span>
        </div>
      </div>
      <p>{shortDescription(props.agent.description ?? props.agent.prompt ?? "暂无描述")}</p>
      <div class="agent-card__meta">
        <span>{props.agent.native ? "内置" : "项目"}</span>
        <span>{props.agent.filePath ? ".railwise/agent" : "默认配置"}</span>
        <span>{props.agent.callCount7d ?? 0} 次 / 7 天</span>
      </div>
    </A>
  )
}
