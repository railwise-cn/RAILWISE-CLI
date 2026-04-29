import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@railwise/util/encode"
import { Icon } from "@railwise/ui/icon"
import { Markdown } from "@railwise/ui/markdown"
import { WorkflowCanvas } from "@/components/workflow-canvas"
import { usePlatform } from "@/context/platform"
import { useAgentStudioApi } from "@/pages/agents/api"
import { setSessionHandoff } from "@/pages/session/handoff"
import type { WikiLogEntry, WikiReport, WikiReportDetail, WikiStatus, WorkflowCheck } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

type ReportKind = "all" | Extract<WikiReport["kind"], "lint" | "diff">

const filters: { kind: ReportKind; label: string }[] = [
  { kind: "all", label: "全部" },
  { kind: "lint", label: "Lint" },
  { kind: "diff", label: "Diff" },
]

function logLabel(kind: WikiLogEntry["kind"]) {
  if (kind === "query") return "查询"
  if (kind === "ingest") return "入库"
  return "维护"
}

function logPaths(entry: WikiLogEntry) {
  if (!entry.paths.length) return "无关联页面"
  return entry.paths.slice(0, 2).join("、")
}

function statusLabel(status: WorkflowCheck["checks"][number]["status"]) {
  if (status === "ok") return "通过"
  if (status === "warn") return "提示"
  return "阻塞"
}

export function WorkflowGallery() {
  const api = useAgentStudioApi()
  const navigate = useNavigate()
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
  const [check, setCheck] = createSignal<WorkflowCheck>()
  const [checking, setChecking] = createSignal(false)
  const [checkError, setCheckError] = createSignal("")
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

  createEffect(() => {
    const workflow = current()
    if (!workflow) return
    const id = workflow.id
    setCheck(undefined)
    setCheckError("")
    setChecking(true)
    void api
      .workflowCheck(id)
      .then((result) => {
        if (current()?.id === id) setCheck(result)
      })
      .catch((err: unknown) => {
        if (current()?.id === id) setCheckError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (current()?.id === id) setChecking(false)
      })
  })

  async function run() {
    const workflow = current()
    if (!workflow) return
    setBusy(true)
    const result = await api.run(workflow.id).finally(() => setBusy(false))
    setNotice(`已导入预设，Session: ${result.sessionTitle ?? result.sessionId}`)
    const key = `${base64Encode(result.directory)}/${result.sessionId}`
    setSessionHandoff(key, { prompt: result.prompt })
    navigate(`/${base64Encode(result.directory)}/session/${result.sessionId}`)
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
          <div class="workflow-check" data-testid="workflow-check">
            <div class="workflow-check__bar">
              <span>工具链检查</span>
              <small>{checking() ? "检查中" : check()?.ok ? "就绪" : "需处理"}</small>
            </div>
            <Show when={!checkError()} fallback={<small title={checkError()}>检查暂不可用</small>}>
              <Show when={check()?.checks.length} fallback={<small>等待检查结果</small>}>
                <For each={check()?.checks ?? []}>
                  {(item) => (
                    <div class={`workflow-check__item ${item.status}`}>
                      <strong>{item.label}</strong>
                      <span>{statusLabel(item.status)}</span>
                      <small>{item.detail}</small>
                    </div>
                  )}
                </For>
              </Show>
            </Show>
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
          <div class="workflow-wiki__activity">
            <div class="workflow-wiki__activity-bar">
              <span>最近 Wiki 活动</span>
              <small>{wiki()?.logCount ?? 0} 条记录</small>
            </div>
            <Show when={wiki()?.logs.length} fallback={<small>暂无查询/维护记录</small>}>
              <For each={wiki()?.logs ?? []}>
                {(item) => (
                  <div class="workflow-wiki__log" title={item.raw}>
                    <strong>{logLabel(item.kind)}</strong>
                    <span>{item.title}</span>
                    <small>{logPaths(item)}</small>
                  </div>
                )}
              </For>
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
