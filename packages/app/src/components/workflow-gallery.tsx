import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { Markdown } from "@railwise/ui/markdown"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { useAgentStudioApi } from "@/pages/agents/api"
import type { WikiReportDetail, WikiStatus } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

export function WorkflowGallery() {
  const api = useAgentStudioApi()
  const [items, setItems] = createSignal<Workflow[]>([])
  const [active, setActive] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [notice, setNotice] = createSignal("")
  const [wiki, setWiki] = createSignal<WikiStatus>()
  const [wikiError, setWikiError] = createSignal("")
  const [report, setReport] = createSignal<WikiReportDetail>()
  const [reportPath, setReportPath] = createSignal("")
  const [reportBusy, setReportBusy] = createSignal(false)
  const [reportError, setReportError] = createSignal("")
  const current = createMemo(() => items().find((item) => item.id === active()) ?? items()[0])
  const wikiActive = createMemo(() => current()?.id === "cpiii-resurvey-wiki")

  async function loadReport(path: string) {
    setReportPath(path)
    setReportBusy(true)
    setReportError("")
    setReport(undefined)
    await api
      .wikiReport(path)
      .then((detail) => {
        if (reportPath() === path) setReport(detail)
      })
      .catch((err: unknown) => setReportError(err instanceof Error ? err.message : String(err)))
      .finally(() => setReportBusy(false))
  }

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
        if (status.reports[0]) void loadReport(status.reports[0].path)
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
                    <button
                      type="button"
                      class="workflow-wiki__report"
                      classList={{ active: reportPath() === report.path }}
                      title={report.absolutePath}
                      aria-pressed={reportPath() === report.path}
                      onClick={() => void loadReport(report.path)}
                    >
                      {report.kind}
                      {" · "}
                      {report.path}
                      {report.problemCount !== undefined ? ` · ${report.problemCount} 问题` : ""}
                      {report.changeCount !== undefined ? ` · ${report.changeCount} 变更` : ""}
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </div>
          <Show when={reportPath()}>
            <article class="workflow-wiki__preview" data-testid="workflow-wiki-report-preview">
              <header>
                <span>{report()?.path ?? reportPath()}</span>
                <small>{reportBusy() ? "加载中" : (report()?.generatedAt ?? report()?.updatedAt ?? "")}</small>
              </header>
              <Show when={!reportError()} fallback={<p>{reportError()}</p>}>
                <Show when={report()} fallback={<small>正在读取报告内容...</small>}>
                  {(item) => <Markdown text={item().rawMarkdown} />}
                </Show>
              </Show>
            </article>
          </Show>
        </div>
      </Show>
      <Show when={current()}>{(workflow) => <WorkflowCanvas workflow={workflow()} />}</Show>
      <Show when={notice()}>
        <p class="workflow-notice">{notice()}</p>
      </Show>
    </section>
  )
}
