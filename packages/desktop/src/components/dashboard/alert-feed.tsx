import { For, Show } from "solid-js"
import type { Alert } from "./types"

export function AlertFeed(props: { alerts: Alert[] }) {
  return (
    <section class="dashboard-panel" data-testid="dashboard-alert-feed">
      <div class="dashboard-panel__head">
        <h2>告警 Feed</h2>
        <span>{props.alerts.length}</span>
      </div>
      <Show when={props.alerts.length > 0} fallback={<p class="dashboard-muted">当前无告警。</p>}>
        <ul class="dashboard-alerts">
          <For each={props.alerts}>
            {(alert) => (
              <li data-level={alert.level}>
                <strong>{alert.level === "error" ? "超限" : "预警"}</strong>
                <p>{alert.message}</p>
                <time>{new Date(alert.time).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </section>
  )
}
