import { Show, createEffect, createMemo, createSignal } from "solid-js"
import { useParams } from "@solidjs/router"
import { PromptInput } from "@/components/prompt-input"
import { TemplateDrawer, useTemplateDrawerShortcut } from "@/components/session/template-drawer"
import { useLanguage } from "@/context/language"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { getSessionHandoff, setSessionHandoff } from "@/pages/session/handoff"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"

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
  const sdk = useSDK()
  const prompt = usePrompt()
  const language = useLanguage()
  const [templates, setTemplates] = createSignal(false)
  let editor: HTMLDivElement | undefined

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const handoffPrompt = createMemo(() => getSessionHandoff(sessionKey())?.prompt)

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
    if (!prompt.ready()) return
    setSessionHandoff(sessionKey(), { prompt: previewPrompt() })
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
              <div class="mb-2 flex justify-end">
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
