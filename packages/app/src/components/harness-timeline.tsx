import { For, Show } from "solid-js"
import { timelineRows, type HarnessEvent } from "./harness-timeline-state"

export type { HarnessEvent } from "./harness-timeline-state"

export function HarnessTimeline(props: { events: HarnessEvent[]; empty?: string }) {
  const rows = () => timelineRows(props.events)
  return (
    <section class="harness-timeline">
      <h2>运行轨迹</h2>
      <Show when={rows().length > 0} fallback={<p>{props.empty ?? "还没有 Harness 事件。"}</p>}>
        <ol>
          <For each={rows()}>
            {(row) => (
              <li data-risk={row.event.risk ?? "low"}>
                <div class="harness-timeline__meta">
                  <span>{row.type}</span>
                  <span>{row.risk}</span>
                  <Show when={row.duration}>
                    <span>{row.duration}</span>
                  </Show>
                </div>
                <strong>{row.event.title}</strong>
                <Show when={row.event.detail}>
                  <p>{row.event.detail}</p>
                </Show>
                <Show when={row.event.artifactPath}>
                  <code>{row.event.artifactPath}</code>
                </Show>
                <Show when={row.event.error}>
                  <p class="harness-timeline__error">{row.event.error}</p>
                </Show>
              </li>
            )}
          </For>
        </ol>
      </Show>
    </section>
  )
}
