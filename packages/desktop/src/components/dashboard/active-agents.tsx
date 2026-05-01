import { For, Show } from "solid-js"
import type { ActiveAgent } from "./types"

export function ActiveAgents(props: { agents: ActiveAgent[] }) {
  return (
    <section class="dashboard-panel" data-testid="dashboard-active-agents">
      <div class="dashboard-panel__head">
        <h2>运行中 Agent</h2>
        <span>{props.agents.length}</span>
      </div>
      <Show when={props.agents.length > 0} fallback={<p class="dashboard-muted">暂无运行中的 Agent。</p>}>
        <ul class="dashboard-agents">
          <For each={props.agents}>
            {(agent) => (
              <li data-status={agent.status}>
                <span />
                <div>
                  <strong>{agent.agentName}</strong>
                  <small>{agent.status === "waiting" ? "等待重试" : agent.status === "error" ? "异常" : "运行中"}</small>
                </div>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
