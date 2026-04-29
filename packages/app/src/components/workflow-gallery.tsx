import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { useAgentStudioApi } from "@/pages/agents/api"
import type { WikiStatus } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

export function WorkflowGallery() {
  const api = useAgentStudioApi()
  const [items, setItems] = createSignal<Workflow[]>([])
  const [active, setActive] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [notice, setNotice] = createSignal("")
  const [wiki, setWiki] = createSignal<WikiStatus>()
  const [wikiError, setWikiError] = createSignal("")
  const current = createMemo(() => items().find((item) => item.id === active()) ?? items()[0])
  const wikiActive = createMemo(() => current()?.id === "cpiii-resurvey-wiki")

  onMount(() => {
    void api.presets().then((presets) => {
      setItems(presets)
      setActive(presets[0]?.id ?? "")
    })
    void api
      .wikiStatus()
      .then((status) => {
        setWiki(status)
        setWikiError("")
      })
      .catch((err: unknown) => setWikiError(err instanceof Error ? err.message : String(err)))
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
          <p>按行业模板串联 chief、researcher、writer、editor 等智能体。</p>
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
      <Show when={wikiActive()}>
        <div class="workflow-wiki" data-testid="workflow-wiki-status">
          <div class="workflow-wiki__stats">
            <div>
              <span>Wiki 页</span>
              <strong>{wiki()?.pageCount ?? "-"}</strong>
            </div>
            <div>
              <span>Raw 源</span>
              <strong>{wiki()?.rawCount ?? "-"}</strong>
            </div>
            <div>
              <span>报告</span>
              <strong>{wiki()?.reportCount ?? "-"}</strong>
            </div>
            <div>
              <span>模式</span>
              <strong>{wiki()?.readonly === undefined ? "-" : wiki()?.readonly ? "只读" : "项目库"}</strong>
            </div>
          </div>
          <div class="workflow-wiki__reports">
            <span>最近变更报告</span>
            <Show when={!wikiError()} fallback={<small title={wikiError()}>Wiki 状态暂不可用</small>}>
              <Show when={wiki()?.reports.length} fallback={<small>暂无 lint/diff 报告</small>}>
                <For each={wiki()?.reports ?? []}>
                  {(report) => (
                    <code title={report.absolutePath}>
                      {report.kind}
                      {" · "}
                      {report.path}
                      {report.problemCount !== undefined ? ` · ${report.problemCount} 问题` : ""}
                      {report.changeCount !== undefined ? ` · ${report.changeCount} 变更` : ""}
                    </code>
                  )}
                </For>
              </Show>
            </Show>
          </div>
        </div>
      </Show>
      <Show when={current()}>{(workflow) => <WorkflowCanvas workflow={workflow()} />}</Show>
      <Show when={notice()}>
        <p class="workflow-notice">{notice()}</p>
      </Show>
    </section>
  )
}
