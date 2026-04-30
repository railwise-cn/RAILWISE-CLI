import { For, Show, createEffect, createMemo, createSignal } from "solid-js"
import { useParams } from "@solidjs/router"
import { PromptInput } from "@/components/prompt-input"
import { TemplateDrawer, useTemplateDrawerShortcut } from "@/components/session/template-drawer"
import { useLanguage } from "@/context/language"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useAgentStudioApi } from "@/pages/agents/api"
import { getSessionHandoff, setSessionHandoff } from "@/pages/session/handoff"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"
import type { WorkflowAcceptance } from "@/types/agent-studio"

type AcceptanceStatus = WorkflowAcceptance["checks"][number]["status"]

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
  const sdk = useSDK()
  const sync = useSync()
  const prompt = usePrompt()
  const language = useLanguage()
  const [templates, setTemplates] = createSignal(false)
  const [applied, setApplied] = createSignal("")
  const [acceptance, setAcceptance] = createSignal<WorkflowAcceptance>()
  const [acceptanceError, setAcceptanceError] = createSignal("")
  const [accepting, setAccepting] = createSignal(false)
  let editor: HTMLDivElement | undefined

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const handoff = createMemo(() => getSessionHandoff(sessionKey()))
  const handoffPrompt = createMemo(() => handoff()?.prompt)
  const sessionTitle = createMemo(() => (params.id ? sync.session.get(params.id)?.title : undefined))
  const workflowId = createMemo(() => {
    const id = handoff()?.workflowId
    if (id) return id
    if (sessionTitle()?.includes("CPIII 规范查询与复测预案")) return "cpiii-resurvey-wiki"
  })
  const workflowName = createMemo(() => handoff()?.workflowName ?? sessionTitle()?.replace(/^工作流：/, ""))
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

  createEffect(() => {
    sessionKey()
    setAcceptance(undefined)
    setAcceptanceError("")
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
                        disabled={accepting()}
                        class="shrink-0 rounded-md border border-[rgba(117,86,32,0.18)] bg-white px-3 py-1.5 text-[12px] font-semibold text-[rgb(95,70,24)] shadow-[0_1px_2px_rgba(0,0,0,0.04)] transition-colors hover:bg-[rgba(117,86,32,0.04)] disabled:opacity-60"
                        onClick={runAcceptance}
                      >
                        {accepting() ? "验收中" : "交付验收"}
                      </button>
                    </div>
                    <Show when={acceptance()}>
                      {(result) => (
                        <div class="mt-2 grid gap-1" data-testid="workflow-acceptance-result">
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
