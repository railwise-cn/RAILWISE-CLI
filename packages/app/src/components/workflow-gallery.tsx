import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { Icon } from "@railwise/ui/icon"
import { Markdown } from "@railwise/ui/markdown"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { usePlatform } from "@/context/platform"
import { useAgentStudioApi } from "@/pages/agents/api"
import type { WikiReport, WikiReportDetail, WikiStatus } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

type ReportKind = "all" | Extract<WikiReport["kind"], "lint" | "diff">

const filters: { kind: ReportKind; label: string }[] = [
  { kind: "all", label: "全部" },
  { kind: "lint", label: "Lint" },
  { kind: "diff", label: "Diff" },
]

export function WorkflowGallery() {
  const api = useAgentStudioApi()
  const platform = usePlatform()
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
  const [kind, setKind] = createSignal<ReportKind>("all")
  const [copied, setCopied] = createSignal(false)
  const current = createMemo(() => items().find((item) => item.id === active()) ?? items()[0])
  const wikiActive = createMemo(() => current()?.id === "cpiii-resurvey-wiki")
  const reports = createMemo(() => wiki()?.reports ?? [])
  const visible = createMemo(() => {
    if (kind() === "all") return reports()
    return reports().filter((item) => item.kind === kind())
  })
  const selected = createMemo(() => report() ?? reports().find((item) => item.path === reportPath()))

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

  function selectKind(value: ReportKind) {
    setKind(value)
    const next = value === "all" ? reports()[0] : reports().find((item) => item.kind === value)
    if (next) {
      void loadReport(next.path)
      return
    }
    setReport(undefined)
    setReportPath("")
    setReportError("")
  }

  function fallbackCopy(text: string) {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.position = "fixed"
    area.style.inset = "-9999px auto auto -9999px"
    document.body.append(area)
    area.select()
    document.execCommand("copy")
    area.remove()
  }

  async function copyReportPath() {
    const path = selected()?.absolutePath ?? reportPath()
    if (!path) return
    const write = navigator.clipboard?.writeText
    await (write ? write.call(navigator.clipboard, path) : Promise.resolve(fallbackCopy(path)))
      .then(() => {
        setCopied(true)
        setNotice("已复制报告路径")
        window.setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        fallbackCopy(path)
        setCopied(true)
        setNotice("已复制报告路径")
        window.setTimeout(() => setCopied(false), 1500)
      })
  }

  function openReportPath() {
    const path = selected()?.absolutePath
    if (!path || !platform.openPath) return
    void platform
      .openPath(path)
      .then(() => setNotice("已打开报告文件"))
      .catch((err: unknown) => setReportError(err instanceof Error ? err.message : String(err)))
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
            <div class="workflow-wiki__reports-bar">
              <span>最近变更报告</span>
              <div class="workflow-wiki__filters" aria-label="报告类型筛选">
                <For each={filters}>
                  {(item) => (
                    <button
                      type="button"
                      classList={{ active: kind() === item.kind }}
                      aria-pressed={kind() === item.kind}
                      onClick={() => selectKind(item.kind)}
                    >
                      {item.label}
                    </button>
                  )}
                </For>
              </div>
            </div>
            <Show when={!wikiError()} fallback={<small title={wikiError()}>Wiki 状态暂不可用</small>}>
              <Show when={visible().length} fallback={<small>暂无 lint/diff 报告</small>}>
                <For each={visible()}>
                  {(item) => (
                    <button
                      type="button"
                      class="workflow-wiki__report"
                      classList={{ active: reportPath() === item.path }}
                      title={item.absolutePath}
                      aria-pressed={reportPath() === item.path}
                      onClick={() => void loadReport(item.path)}
                    >
                      {item.kind}
                      {" · "}
                      {item.path}
                      {item.problemCount !== undefined ? ` · ${item.problemCount} 问题` : ""}
                      {item.changeCount !== undefined ? ` · ${item.changeCount} 变更` : ""}
                    </button>
                  )}
                </For>
              </Show>
            </Show>
          </div>
          <Show when={reportPath()}>
            <article class="workflow-wiki__preview" data-testid="workflow-wiki-report-preview">
              <header>
                <div>
                  <span>{selected()?.path ?? reportPath()}</span>
                  <small>{reportBusy() ? "加载中" : (selected()?.generatedAt ?? selected()?.updatedAt ?? "")}</small>
                </div>
                <div class="workflow-wiki__preview-actions">
                  <button type="button" class="workflow-wiki__action" onClick={() => void copyReportPath()}>
                    <Icon name={copied() ? "check" : "copy"} size="small" />
                    <span>{copied() ? "已复制" : "复制路径"}</span>
                  </button>
                  <Show when={platform.openPath && selected()?.absolutePath}>
                    <button type="button" class="workflow-wiki__action" onClick={openReportPath}>
                      <Icon name="open-file" size="small" />
                      <span>打开原文件</span>
                    </button>
                  </Show>
                </div>
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
