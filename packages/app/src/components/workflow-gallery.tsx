import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { useAgentStudioApi } from "@/pages/agents/api"
import type { Workflow } from "@/types/workflow"

export function WorkflowGallery() {
  const api = useAgentStudioApi()
  const [items, setItems] = createSignal<Workflow[]>([])
  const [active, setActive] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [notice, setNotice] = createSignal("")
  const current = createMemo(() => items().find((item) => item.id === active()) ?? items()[0])

  onMount(async () => {
    const presets = await api.presets()
    setItems(presets)
    setActive(presets[0]?.id ?? "")
  })

  async function run() {
    const workflow = current()
    if (!workflow) return
    setBusy(true)
    const result = await api.run(workflow.id).finally(() => setBusy(false))
    setNotice(`已导入预设，Session: ${result.sessionTitle ?? result.sessionId}`)
  }

  return (
    <section class="workflow-gallery" data-testid="workflow-gallery">
      <div class="agent-section__header">
        <div>
          <h2>工作流预设</h2>
          <p>按行业模板串联总工程师、外业首检、平差计算、报告编制和总工复核。</p>
        </div>
        <button type="button" class="agent-button" data-testid="workflow-run-btn" disabled={busy()} onClick={run}>
          导入预设
        </button>
      </div>
      <div class="workflow-tabs">
        <For each={items()}>
          {(item) => (
            <button
              type="button"
              data-testid={`workflow-card-${item.id}`}
              classList={{ active: current()?.id === item.id }}
              onClick={() => setActive(item.id)}
            >
              <span>{item.name}</span>
              <small>{item.description}</small>
            </button>
          )}
        </For>
      </div>
      <Show when={current()}>{(workflow) => <WorkflowCanvas workflow={workflow()} />}</Show>
      <Show when={notice()}>
        <p class="workflow-notice">{notice()}</p>
      </Show>
    </section>
  )
}
