import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { useParams } from "@solidjs/router"
import { Icon } from "@railwise/ui/icon"
import { PromptInput } from "@/components/prompt-input"
import { TemplateDrawer, useTemplateDrawerShortcut } from "@/components/session/template-drawer"
import { useLanguage } from "@/context/language"
import { usePlatform } from "@/context/platform"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useAgentStudioApi } from "@/pages/agents/api"
import { getSessionHandoff, setSessionHandoff } from "@/pages/session/handoff"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"
import {
  deliveryFileCount,
  deliveryFiles,
  deliveryMissingCount,
  deliveryRows,
  deliveryStatus,
} from "@/pages/session/composer/workflow-delivery"
import type {
  WorkflowAcceptance,
  WorkflowRunArtifact,
  WorkflowSession,
} from "@/types/agent-studio"

type AcceptanceStatus = WorkflowAcceptance["checks"][number]["status"]
type WorkflowStage = "imported" | "pending" | "running" | "review" | "failed" | "passed"

const workflowSteps: { id: WorkflowStage; label: string }[] = [
  { id: "imported", label: "已导入" },
  { id: "pending", label: "待发送" },
  { id: "running", label: "执行中" },
  { id: "review", label: "待验收" },
  { id: "failed", label: "需返工" },
  { id: "passed", label: "已通过" },
]

function acceptanceLabel(status: AcceptanceStatus) {
  if (status === "ok") return "通过"
  if (status === "warn") return "提示"
  return "阻塞"
}

function acceptanceTone(status: AcceptanceStatus) {
  if (status === "ok") return "text-[rgb(31,118,71)]"
  if (status === "warn") return "text-[rgb(146,94,15)]"
  return "text-text-danger-base"
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

export function SessionComposerRegion(props: {
  state: SessionComposerState
  centered: boolean
  inputRef: (el: HTMLDivElement) => void
  newSessionWorktree: string
  onNewSessionWorktreeReset: () => void
  onSubmit: () => void
  onResponseSubmit: () => void
  setPromptDockRef: (el: HTMLDivElement) => void
}) {
  const params = useParams()
  const api = useAgentStudioApi()
  const platform = usePlatform()
  const sdk = useSDK()
  const sync = useSync()
  const prompt = usePrompt()
  const language = useLanguage()
  const [templates, setTemplates] = createSignal(false)
  const [applied, setApplied] = createSignal("")
  const [acceptance, setAcceptance] = createSignal<WorkflowAcceptance>()
  const [acceptanceError, setAcceptanceError] = createSignal("")
  const [artifactNotice, setArtifactNotice] = createSignal("")
  const [accepting, setAccepting] = createSignal(false)
  const [archiving, setArchiving] = createSignal(false)
  const [stored, setStored] = createSignal<WorkflowSession>()
  const [submitRequest, setSubmitRequest] = createSignal(0)
  let editor: HTMLDivElement | undefined

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const handoff = createMemo(() => getSessionHandoff(sessionKey()))
  const handoffPrompt = createMemo(() => handoff()?.prompt)
  const sessionTitle = createMemo(() => (params.id ? sync.session.get(params.id)?.title : undefined))
  const workflowId = createMemo(() => {
    const id = handoff()?.workflowId ?? stored()?.workflowId
    if (id) return id
    if (sessionTitle()?.includes("CPIII 规范查询与复测预案")) return "cpiii-resurvey-wiki"
  })
  const workflowName = createMemo(
    () => handoff()?.workflowName ?? stored()?.workflowName ?? sessionTitle()?.replace(/^工作流：/, ""),
  )
  const artifacts = createMemo(() => handoff()?.artifacts ?? stored()?.artifacts ?? [])
  const delivery = createMemo(() => stored()?.delivery)
  const canAccept = createMemo(() => Boolean(params.id && workflowId() === "cpiii-resurvey-wiki"))

  const previewPrompt = () =>
    prompt
      .current()
      .map((part) => {
        if (part.type === "file") return `[file:${part.path}]`
        if (part.type === "agent") return `@${part.name}`
        if (part.type === "image") return `[image:${part.filename}]`
        return part.content
      })
      .join("")
      .trim()
  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))
  const userMessageCount = createMemo(() => messages().filter((message) => message.role === "user").length)
  const assistantMessageCount = createMemo(() => messages().filter((message) => message.role === "assistant").length)
  const sessionStatus = createMemo(() => sync.data.session_status[params.id ?? ""] ?? { type: "idle" })
  const working = createMemo(() => sessionStatus()?.type !== "idle")
  const hasDraft = createMemo(() => prompt.ready() && previewPrompt().length > 0)
  const workflowStage = createMemo<WorkflowStage>(() => {
    if (acceptance()?.ok) return "passed"
    if (acceptance()) return "failed"
    if (working()) return "running"
    if (assistantMessageCount() > 0) return "review"
    if (userMessageCount() > 0) return "running"
    return "pending"
  })
  const workflowStepIndex = createMemo(() => workflowSteps.findIndex((step) => step.id === workflowStage()))
  const failedChecks = createMemo(() => acceptance()?.checks.filter((item) => item.status === "fail") ?? [])

  createEffect(() => {
    const id = params.id
    sessionKey()
    setStored(undefined)
    setAcceptance(undefined)
    setAcceptanceError("")
    setArtifactNotice("")
    if (!id) return
    void api
      .workflowSession(id)
      .then((info) => {
        if (params.id !== id) return
        setStored(info)
        setAcceptance(info.acceptance)
      })
      .catch(() => {})
  })

  createEffect(() => {
    if (!prompt.ready()) return
    if (handoffPrompt()?.trim() && applied() !== sessionKey() && !prompt.dirty()) return
    setSessionHandoff(sessionKey(), { prompt: previewPrompt() })
  })

  createEffect(() => {
    if (!prompt.ready()) return
    const text = handoffPrompt()?.trim()
    if (!text) return
    const key = sessionKey()
    if (applied() === key) return
    if (prompt.dirty()) return
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
    setApplied(key)
  })

  useTemplateDrawerShortcut(() => setTemplates(true))

  const applyTemplate = (input: { agent: string; prompt: string }) => {
    const agent = `@${input.agent}`
    const text = `\n${input.prompt}`
    prompt.set(
      [
        { type: "agent", name: input.agent, content: agent, start: 0, end: agent.length },
        { type: "text", content: text, start: agent.length, end: agent.length + text.length },
      ],
      agent.length + text.length,
    )
    requestAnimationFrame(() => editor?.focus())
  }

  const runAcceptance = () => {
    const id = params.id
    const workflow = workflowId()
    if (!id || !workflow) return
    setAccepting(true)
    setAcceptanceError("")
    void api
      .workflowAcceptance(workflow, id)
      .then(setAcceptance)
      .catch((err: unknown) => setAcceptanceError(err instanceof Error ? err.message : String(err)))
      .finally(() => setAccepting(false))
  }

  const runArchive = () => {
    const id = params.id
    const workflow = workflowId()
    if (!id || !workflow) return
    setArchiving(true)
    setAcceptanceError("")
    void api
      .workflowDeliveryArchive(workflow, id)
      .then((result) => {
        setStored((info) => ({
          sessionId: info?.sessionId ?? result.sessionId,
          workflowId: info?.workflowId ?? result.workflowId,
          workflowName: info?.workflowName ?? result.workflowName,
          createdAt: info?.createdAt ?? result.generatedAt,
          updatedAt: result.generatedAt,
          artifacts: info?.artifacts,
          acceptance: info?.acceptance ?? acceptance(),
          delivery: result,
        }))
        setArtifactNotice("已导出交付包")
      })
      .catch((err: unknown) => setAcceptanceError(err instanceof Error ? err.message : String(err)))
      .finally(() => setArchiving(false))
  }

  const copyPath = (value: string) => {
    const write = navigator.clipboard?.writeText
    void (write ? write.call(navigator.clipboard, value) : Promise.resolve(fallbackCopy(value)))
      .then(() => setArtifactNotice("已复制路径"))
      .catch(() => {
        fallbackCopy(value)
        setArtifactNotice("已复制路径")
      })
  }

  const openPath = (value?: string) => {
    if (!value || !platform.openPath) return
    void platform
      .openPath(value)
      .then(() => setArtifactNotice("已打开路径"))
      .catch((err: unknown) => setArtifactNotice(err instanceof Error ? err.message : String(err)))
  }

  const artifactRows = (artifact: WorkflowRunArtifact) => [
    { label: "Markdown", path: artifact.markdownPath, absolute: artifact.absoluteMarkdownPath },
    { label: "JSON", path: artifact.jsonPath, absolute: artifact.absoluteJsonPath },
  ]

  const buildReworkPrompt = () => {
    const result = acceptance()
    const checks = failedChecks().length
      ? failedChecks()
      : (result?.checks.filter((item) => item.status !== "ok") ?? [])
    const attachmentLines = artifacts().flatMap((artifact) =>
      artifactRows(artifact).map((row) => `- ${artifact.title} ${row.label}: ${row.path}`),
    )

    return [
      "请继续返工 CPIII 复测交付，优先修复以下验收阻塞项：",
      ...(checks.length
        ? checks.map((item, index) => `${index + 1}. ${item.label}: ${item.detail}`)
        : ["1. 重新核对验收输出，补齐缺失信息。"]),
      "",
      "必须保留并逐字引用以下附件路径：",
      ...(attachmentLines.length ? attachmentLines : ["- 暂无已登记附件，请先生成并登记交付附件。"]),
      "",
      "完成后请再次输出包含「附件引用」「规范引用」「工具结果摘要」的小节，并明确哪些阻塞项已经修复。",
    ].join("\n")
  }

  const applyReworkPrompt = () => {
    applyTemplate({ agent: "chief_manager", prompt: buildReworkPrompt() })
    setArtifactNotice("已生成返工指令")
  }

  const workflowActionLabel = createMemo(() => {
    if (archiving()) return "导出中"
    if (accepting()) return "验收中"
    if (acceptance()?.ok) return delivery() ? "重新导出" : "导出摘要"
    if (workflowStage() === "failed") return "继续返工"
    if (workflowStage() === "pending") return "开始执行"
    if (workflowStage() === "running") return working() ? "执行中" : "等待输出"
    return "交付验收"
  })

  const workflowActionIcon = createMemo(() => {
    if (acceptance()?.ok) return "archive" as const
    if (workflowStage() === "failed") return "edit" as const
    if (workflowStage() === "pending") return "arrow-up" as const
    if (workflowStage() === "running") return "enter" as const
    return "checklist" as const
  })

  const workflowActionDisabled = createMemo(() => {
    if (accepting() || archiving()) return true
    if (acceptance()?.ok) return false
    if (workflowStage() === "pending") return !hasDraft()
    if (workflowStage() === "running") return true
    return false
  })

  const runWorkflowAction = () => {
    if (workflowActionDisabled()) return
    if (acceptance()?.ok) {
      runArchive()
      return
    }
    if (workflowStage() === "pending") {
      setSubmitRequest((value) => value + 1)
      return
    }
    if (workflowStage() === "failed") {
      applyReworkPrompt()
      return
    }
    runAcceptance()
  }

  return (
    <div
      ref={props.setPromptDockRef}
      data-component="session-prompt-dock"
      class="shrink-0 w-full pb-3 flex flex-col justify-center items-center bg-background-stronger pointer-events-none"
    >
      <div
        classList={{
          "w-full px-3 pointer-events-auto": true,
          "md:max-w-200 md:mx-auto 2xl:max-w-[1000px]": props.centered,
        }}
      >
        <Show when={props.state.questionRequest()} keyed>
          {(request) => (
            <div>
              <SessionQuestionDock request={request} onSubmit={props.onResponseSubmit} />
            </div>
          )}
        </Show>

        <Show when={props.state.permissionRequest()} keyed>
          {(request) => (
            <div>
              <SessionPermissionDock
                request={request}
                responding={props.state.permissionResponding()}
                onDecide={(response) => {
                  props.onResponseSubmit()
                  props.state.decide(response)
                }}
              />
            </div>
          )}
        </Show>

        <Show when={!props.state.blocked()}>
          <Show
            when={prompt.ready()}
            fallback={
              <div class="w-full min-h-32 md:min-h-40 rounded-md border border-border-weak-base bg-background-base/50 px-4 py-3 text-text-weak whitespace-pre-wrap pointer-events-none">
                {handoffPrompt() || language.t("prompt.loading")}
              </div>
            }
          >
            <Show when={props.state.dock()}>
              <div
                classList={{
                  "transition-[max-height,opacity,transform] duration-[400ms] ease-out overflow-hidden": true,
                  "max-h-[320px]": !props.state.closing(),
                  "max-h-0 pointer-events-none": props.state.closing(),
                  "opacity-0 translate-y-9": props.state.closing() || props.state.opening(),
                  "opacity-100 translate-y-0": !props.state.closing() && !props.state.opening(),
                }}
              >
                <SessionTodoDock
                  todos={props.state.todos()}
                  title={language.t("session.todo.title")}
                  collapseLabel={language.t("session.todo.collapse")}
                  expandLabel={language.t("session.todo.expand")}
                />
              </div>
            </Show>
            <div
              classList={{
                "relative z-10": true,
                "transition-[margin] duration-[400ms] ease-out": true,
                "-mt-9": props.state.dock() && !props.state.closing(),
                "mt-0": !props.state.dock() || props.state.closing(),
              }}
            >
              <div class="mb-2 flex flex-wrap items-start justify-between gap-2">
                <Show when={canAccept()}>
                  <div
                    class="min-w-0 flex-1 rounded-md border border-border-weak-base bg-background-base/70 px-3 py-2 shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
                    data-testid="workflow-acceptance-panel"
                  >
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <div class="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-12-regular text-text-weak">
                        <span class="text-12-medium text-text-strong truncate">
                          {workflowName() ?? "工作流"} · 交付验收
                        </span>
                        <Show when={acceptance()}>
                          {(result) => (
                            <>
                              <span class={result().ok ? "text-[rgb(31,118,71)]" : "text-text-danger-base"}>
                                {result().ok ? "通过" : "需返工"}
                              </span>
                              <span>{result().messageCount} 条消息</span>
                            </>
                          )}
                        </Show>
                        <Show when={acceptanceError()}>
                          {(message) => <span class="text-text-danger-base truncate">{message()}</span>}
                        </Show>
                      </div>
                      <button
                        type="button"
                        data-testid="workflow-acceptance-btn"
                        data-action="workflow-primary-action"
                        disabled={workflowActionDisabled()}
                        classList={{
                          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors disabled:opacity-60": true,
                          "border-[rgba(160,42,42,0.22)] bg-[rgba(160,42,42,0.06)] text-text-danger-base hover:bg-[rgba(160,42,42,0.09)]":
                            workflowStage() === "failed",
                          "border-[rgba(31,118,71,0.25)] bg-[rgba(31,118,71,0.07)] text-[rgb(31,118,71)] hover:bg-[rgba(31,118,71,0.1)]":
                            workflowStage() === "passed",
                          "border-[rgba(117,86,32,0.18)] bg-white text-[rgb(95,70,24)] hover:bg-[rgba(117,86,32,0.04)]":
                            workflowStage() !== "failed" && workflowStage() !== "passed",
                        }}
                        onClick={runWorkflowAction}
                      >
                        <Icon name={workflowActionIcon()} size="small" />
                        <span>{workflowActionLabel()}</span>
                      </button>
                    </div>
                    <div class="mt-2 flex flex-wrap items-center gap-1.5" data-testid="workflow-status-bar">
                      <For each={workflowSteps}>
                        {(step, index) => {
                          const active = () => workflowStage() === step.id
                          const done = () => index() < workflowStepIndex()
                          const danger = () => active() && step.id === "failed"
                          const success = () => active() && step.id === "passed"
                          return (
                            <div
                              data-state={active() ? "active" : done() ? "done" : "todo"}
                              classList={{
                                "flex h-7 min-w-0 items-center gap-1.5 rounded-md border px-2 text-11-medium": true,
                                "border-[rgba(31,118,71,0.22)] bg-[rgba(31,118,71,0.06)] text-[rgb(31,118,71)]":
                                  done() || success(),
                                "border-[rgba(160,42,42,0.22)] bg-[rgba(160,42,42,0.06)] text-text-danger-base":
                                  danger(),
                                "border-[rgba(117,86,32,0.18)] bg-[rgba(117,86,32,0.05)] text-[rgb(95,70,24)]":
                                  active() && !danger() && !success(),
                                "border-border-weak-base bg-background-base text-text-weak":
                                  !active() && !done(),
                              }}
                            >
                              <span
                                classList={{
                                  "size-1.5 shrink-0 rounded-full": true,
                                  "bg-[rgb(31,118,71)]": done() || success(),
                                  "bg-text-danger-base": danger(),
                                  "bg-[rgb(117,86,32)]": active() && !danger() && !success(),
                                  "bg-border-strong-base": !active() && !done(),
                                }}
                              />
                              <span class="whitespace-nowrap">{step.label}</span>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                    <Show when={artifacts().length}>
                      <div class="mt-2 grid gap-1" data-testid="workflow-artifact-list">
                        <For each={artifacts()}>
                          {(artifact) => (
                            <div class="rounded-md bg-surface-base px-2 py-1.5 text-12-regular">
                              <div class="mb-1 flex items-center justify-between gap-2">
                                <strong class="min-w-0 truncate text-text-strong">{artifact.title}</strong>
                                <Show when={artifactNotice()}>
                                  {(message) => <span class="shrink-0 text-11-regular text-text-weak">{message()}</span>}
                                </Show>
                              </div>
                              <For each={artifactRows(artifact)}>
                                {(row) => (
                                  <div class="grid items-center gap-1 py-0.5 md:grid-cols-[72px_1fr_auto]">
                                    <span class="text-text-weak">{row.label}</span>
                                    <code class="min-w-0 truncate text-11-regular text-text-base" title={row.path}>
                                      {row.path}
                                    </code>
                                    <div class="flex items-center gap-1">
                                      <button
                                        type="button"
                                        class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                        title="复制路径"
                                        onClick={() => copyPath(row.path)}
                                      >
                                        <Icon name="copy" size="small" />
                                      </button>
                                      <Show when={platform.openPath && row.absolute}>
                                        <button
                                          type="button"
                                          class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                          title="打开文件"
                                          onClick={() => openPath(row.absolute)}
                                        >
                                          <Icon name="open-file" size="small" />
                                        </button>
                                      </Show>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                    <Show when={delivery()}>
                      {(item) => (
                        <div
                          class="mt-2 rounded-md border border-[rgba(31,118,71,0.18)] bg-[rgba(31,118,71,0.05)] px-2 py-1.5 text-12-regular"
                          data-testid="workflow-delivery-archive"
                        >
                          <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
                            <div class="flex min-w-0 items-center gap-2">
                              <strong class="text-[rgb(31,118,71)]">交付包</strong>
                              <span
                                classList={{
                                  "rounded-sm bg-background-base px-1.5 py-0.5 text-11-regular": true,
                                  "text-text-danger-base": deliveryMissingCount(item()) > 0,
                                  "text-text-weak": deliveryMissingCount(item()) === 0,
                                }}
                              >
                                {deliveryStatus(item())}
                              </span>
                            </div>
                            <span class="shrink-0 text-11-regular text-text-weak">{item().generatedAt}</span>
                          </div>
                          <Show when={deliveryMissingCount(item()) > 0}>
                            <div class="mb-1.5 rounded-md bg-background-base px-2 py-1.5 text-12-regular text-text-danger-base">
                              有文件未写入交付包。请重新导出，或检查源文件是否还在原路径且可读。
                            </div>
                          </Show>
                          <For each={deliveryRows(item())}>
                            {(row) => (
                              <div class="grid items-center gap-1 py-0.5 md:grid-cols-[72px_1fr_auto]">
                                <span class="text-text-weak">{row.label}</span>
                                <code class="min-w-0 truncate text-11-regular text-text-base" title={row.path}>
                                  {row.path}
                                </code>
                                <div class="flex items-center gap-1">
                                  <button
                                    type="button"
                                    class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                    title="复制路径"
                                    onClick={() => copyPath(row.path)}
                                  >
                                    <Icon name="copy" size="small" />
                                  </button>
                                  <Show when={platform.openPath && row.absolute}>
                                    <button
                                      type="button"
                                      class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                      title={row.folder ? "打开目录" : "打开文件"}
                                      onClick={() => openPath(row.absolute)}
                                    >
                                      <Icon name={row.folder ? "folder" : "open-file"} size="small" />
                                    </button>
                                  </Show>
                                </div>
                              </div>
                            )}
                          </For>
                          <Show when={deliveryFiles(item()).length}>
                            <div
                              class="mt-1.5 grid gap-1 border-t border-[rgba(31,118,71,0.14)] pt-1.5"
                              data-testid="workflow-delivery-file-list"
                            >
                              <div class="flex items-center justify-between gap-2 text-11-regular text-text-weak">
                                <span>包内文件</span>
                                <span>{deliveryFileCount(item())} 个已写入</span>
                              </div>
                              <For each={deliveryFiles(item())}>
                                {(file) => (
                                  <div class="grid items-center gap-1 rounded-md bg-background-base px-2 py-1.5 md:grid-cols-[76px_56px_1fr_auto]">
                                    <strong class="min-w-0 truncate text-12-medium text-text-strong">
                                      {file.label}
                                    </strong>
                                    <span
                                      classList={{
                                        "text-11-regular": true,
                                        "text-[rgb(31,118,71)]": file.copied,
                                        "text-text-danger-base": !file.copied,
                                      }}
                                    >
                                      {file.status}
                                    </span>
                                    <code
                                      class="min-w-0 truncate text-11-regular text-text-base"
                                      title={file.source ? `${file.path}\n源文件：${file.source}` : file.path}
                                    >
                                      {file.path}
                                    </code>
                                    <div class="flex items-center gap-1">
                                      <button
                                        type="button"
                                        class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                        title="复制路径"
                                        onClick={() => copyPath(file.path)}
                                      >
                                        <Icon name="copy" size="small" />
                                      </button>
                                      <Show when={platform.openPath && file.absolute && file.copied}>
                                        <button
                                          type="button"
                                          class="size-6 rounded-md border border-border-weak-base bg-background-base text-text-weak transition-colors hover:text-text-strong"
                                          title="打开文件"
                                          onClick={() => openPath(file.absolute)}
                                        >
                                          <Icon name="open-file" size="small" />
                                        </button>
                                      </Show>
                                    </div>
                                  </div>
                                )}
                              </For>
                            </div>
                          </Show>
                        </div>
                      )}
                    </Show>
                    <Show when={acceptance()}>
                      {(result) => (
                        <div class="mt-2 grid gap-1" data-testid="workflow-acceptance-result">
                          <Show when={!result().ok}>
                            <div class="rounded-md bg-surface-base px-2 py-1.5 text-12-regular text-text-danger-base">
                              完成前需补齐 {result().checks.filter((item) => item.status === "fail").length} 项阻塞项。
                            </div>
                          </Show>
                          <For each={result().checks}>
                            {(item) => (
                              <div class="grid gap-1 rounded-md bg-surface-base px-2 py-1.5 text-12-regular md:grid-cols-[96px_56px_1fr]">
                                <strong class="text-text-strong">{item.label}</strong>
                                <span class={acceptanceTone(item.status)}>{acceptanceLabel(item.status)}</span>
                                <small class="min-w-0 text-text-weak">{item.detail}</small>
                              </div>
                            )}
                          </For>
                        </div>
                      )}
                    </Show>
                  </div>
                </Show>
                <button
                  type="button"
                  data-action="session-template-drawer"
                  class="rounded-md border border-[rgba(117,86,32,0.18)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[rgb(95,70,24)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-[rgba(117,86,32,0.04)]"
                  onClick={() => setTemplates(true)}
                >
                  业务模板
                </button>
              </div>
              <PromptInput
                ref={(el) => {
                  editor = el
                  props.inputRef(el)
                }}
                newSessionWorktree={props.newSessionWorktree}
                onNewSessionWorktreeReset={props.onNewSessionWorktreeReset}
                onSubmit={props.onSubmit}
                submitRequest={submitRequest}
              />
              <TemplateDrawer
                open={templates()}
                directory={sdk.directory}
                onClose={() => setTemplates(false)}
                onSend={applyTemplate}
              />
            </div>
          </Show>
        </Show>
      </div>
    </div>
  )
}
