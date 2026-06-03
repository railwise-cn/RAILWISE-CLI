import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js"
import { useParams } from "@solidjs/router"
import { useDialog } from "@railwise/ui/context/dialog"
import { getFilename } from "@railwise/util/path"
import { DialogManageModels } from "@/components/dialog-manage-models"
import { DialogSelectModel } from "@/components/dialog-select-model"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { PromptInput } from "@/components/prompt-input"
import { TemplateDrawer, useTemplateDrawerShortcut } from "@/components/session/template-drawer"
import { useLanguage } from "@/context/language"
import { useLocal } from "@/context/local"
import { usePrompt, type Prompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { useProviders } from "@/hooks/use-providers"
import { useAgentStudioApi } from "@/pages/agents/api"
import { getSessionHandoff, setSessionHandoff } from "@/pages/session/handoff"
import { SessionPermissionDock } from "@/pages/session/composer/session-permission-dock"
import { SessionQuestionDock } from "@/pages/session/composer/session-question-dock"
import type { SessionComposerState } from "@/pages/session/composer/session-composer-state"
import {
  agentMentionPrompt,
  agentModelLabel,
  capabilityPrompt,
  collaborationAgents,
  recommendedModel,
} from "@/pages/session/composer/collaboration"
import { SessionTodoDock } from "@/pages/session/composer/session-todo-dock"
import type { SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"

function agentFromPrompt(value?: string) {
  return value?.trimStart().match(/^@([A-Za-z0-9_-]+)/)?.[1]
}

function promptLength(parts: Prompt) {
  return parts.reduce((sum, part) => ("content" in part ? sum + part.content.length : sum), 0)
}

function handoffPromptParts(agent: string | undefined, value: string): Prompt {
  const text = value.trim()
  if (!agent) return [{ type: "text", content: text, start: 0, end: text.length }]

  const mention = `@${agent}`
  const body = text.startsWith(mention) ? text.slice(mention.length) : `\n${text}`
  const head = { type: "agent" as const, name: agent, content: mention, start: 0, end: mention.length }
  if (!body) return [head]
  return [
    head,
    { type: "text" as const, content: body, start: mention.length, end: mention.length + body.length },
  ]
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
  const dialog = useDialog()
  const sdk = useSDK()
  const sync = useSync()
  const prompt = usePrompt()
  const local = useLocal()
  const language = useLanguage()
  const providers = useProviders()
  const [templates, setTemplates] = createSignal(false)
  const [expanded, setExpanded] = createSignal(false)
  const [applied, setApplied] = createSignal("")
  const [tools, setTools] = createSignal<ToolInventoryItem[]>([])
  const [skills, setSkills] = createSignal<SkillInventoryItem[]>([])
  let editor: HTMLDivElement | undefined

  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const handoff = createMemo(() => getSessionHandoff(sessionKey()))
  const handoffPrompt = createMemo(() => handoff()?.prompt)
  const handoffAgent = createMemo(() => handoff()?.agent ?? agentFromPrompt(handoffPrompt()))

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

  const activeAgent = createMemo(() => local.agent.current()?.name ?? handoffAgent() ?? "未选择")
  const agentPalette = createMemo(() => collaborationAgents(sync.data.agent).slice(0, 7))
  const workspaceName = createMemo(() => getFilename(sdk.directory) || sdk.directory)
  const visibleTools = createMemo(() => tools().slice(0, 6))
  const visibleSkills = createMemo(() => skills().slice(0, 6))
  const currentModel = createMemo(() => local.model.current())
  const visibleModels = createMemo(() =>
    local.model.list().filter((model) => local.model.visible({ providerID: model.provider.id, modelID: model.id })),
  )
  const connectedProviders = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const currentModelLabel = createMemo(() => {
    const model = currentModel()
    if (!model) return "未选择模型"
    return `${model.provider.name} / ${model.name}`
  })
  const modelAction = createMemo(() => {
    if (currentModel()) return
    if (visibleModels().length > 0) return { label: "选择模型", open: () => dialog.show(() => <DialogSelectModel />) }
    if (connectedProviders().length > 0)
      return { label: "启用模型", open: () => dialog.show(() => <DialogManageModels />) }
    return { label: "接入模型", open: () => dialog.show(() => <DialogSelectProvider />) }
  })
  const modelStatus = createMemo(() => {
    if (currentModel()) return
    if (visibleModels().length > 0) return "发送前请选择一个可用模型"
    if (connectedProviders().length > 0) return "模型 Provider 已接入，先启用一个模型"
    return `发送前先接入模型，建议 ${recommendedModel} 或 OpenRouter`
  })

  createEffect(() => {
    if (!prompt.ready()) return
    if (handoffPrompt()?.trim() && applied() !== sessionKey() && !prompt.dirty()) return
    setSessionHandoff(sessionKey(), { prompt: previewPrompt() })
  })

  createEffect(() => {
    const agent = handoffAgent()
    if (!agent) return
    if (!local.agent.list().some((item) => item.name === agent)) return
    local.agent.set(agent)
  })

  createEffect(() => {
    if (!prompt.ready()) return
    const text = handoffPrompt()?.trim()
    if (!text) return
    const key = sessionKey()
    if (applied() === key) return
    if (prompt.dirty()) return
    const next = handoffPromptParts(handoffAgent(), text)
    prompt.set(next, promptLength(next))
    setApplied(key)
  })

  onMount(() => {
    void Promise.allSettled([api.tools(), api.skills()]).then(([toolset, skillset]) => {
      if (toolset.status === "fulfilled") setTools(toolset.value)
      if (skillset.status === "fulfilled") setSkills(skillset.value)
    })
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

  const applyAgent = (name: string) => {
    const text = agentMentionPrompt(name, previewPrompt())
    const agent = `@${name}`
    const body = text.slice(agent.length)
    prompt.set(
      [
        { type: "agent", name, content: agent, start: 0, end: agent.length },
        { type: "text", content: body, start: agent.length, end: agent.length + body.length },
      ],
      text.length,
    )
    requestAnimationFrame(() => editor?.focus())
  }

  const applyCapability = (kind: "tool" | "skill", name: string) => {
    const text = capabilityPrompt({ kind, name }, previewPrompt())
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
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
              <div
                class="mb-2 rounded-md border border-[rgba(15,118,110,0.18)] bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                data-testid="session-collaboration-panel"
              >
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="min-w-0">
                    <div class="text-[12px] font-semibold text-[rgb(17,94,89)]">协作</div>
                    <div class="truncate text-[12px] text-text-weak" title={sdk.directory}>
                      {workspaceName()} · 主智能体 {activeAgent()}
                    </div>
                  </div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="rounded-md bg-[rgba(15,118,110,0.08)] px-2 py-1 text-[12px] text-[rgb(17,94,89)]">
                      {currentModelLabel()}
                    </span>
                    <span class="text-[12px] text-text-weak">默认建议 {recommendedModel}</span>
                    <button
                      type="button"
                      class="rounded-md border border-[rgba(15,118,110,0.22)] bg-white px-2 py-1 text-[12px] font-semibold text-[rgb(17,94,89)] hover:bg-[rgba(15,118,110,0.06)]"
                      onClick={() => dialog.show(() => <DialogSelectModel />)}
                    >
                      选择模型
                    </button>
                    <button
                      type="button"
                      data-action="session-template-drawer"
                      class="rounded-md border border-[rgba(117,86,32,0.18)] bg-white px-2 py-1 text-[12px] font-semibold text-[rgb(95,70,24)] hover:bg-[rgba(117,86,32,0.04)]"
                      onClick={() => setTemplates(true)}
                    >
                      业务模板
                    </button>
                    <button
                      type="button"
                      class="rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1 text-[12px] font-semibold text-text-base hover:bg-surface-raised-base-hover"
                      aria-expanded={expanded()}
                      onClick={() => setExpanded(!expanded())}
                    >
                      能力
                    </button>
                  </div>
                </div>

                <Show when={modelStatus()}>
                  <div
                    class="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-[rgba(117,86,32,0.18)] bg-[rgba(117,86,32,0.06)] px-2.5 py-2 text-[12px]"
                    data-testid="session-model-readiness"
                  >
                    <span class="text-[rgb(95,70,24)]">{modelStatus()}</span>
                    <Show when={modelAction()}>
                      {(action) => (
                        <button
                          type="button"
                          class="rounded-md border border-[rgba(117,86,32,0.22)] bg-white px-2 py-1 font-semibold text-[rgb(95,70,24)] hover:bg-[rgba(117,86,32,0.04)]"
                          data-testid="session-model-setup"
                          onClick={() => action().open()}
                        >
                          {action().label}
                        </button>
                      )}
                    </Show>
                  </div>
                </Show>

                <Show when={expanded()}>
                  <div class="mt-2 flex flex-wrap gap-1.5">
                    <For each={agentPalette()}>
                      {(agent) => (
                        <button
                          type="button"
                          class="rounded-full border border-[rgba(15,118,110,0.2)] bg-[rgba(15,118,110,0.06)] px-2.5 py-1 text-[12px] text-text-base hover:border-[rgba(15,118,110,0.45)]"
                          title={`模型：${agentModelLabel(agent)}`}
                          onClick={() => applyAgent(agent.name)}
                        >
                          @{agent.name}
                        </button>
                      )}
                    </For>
                  </div>

                  <div class="mt-2 grid gap-2 md:grid-cols-2">
                    <div class="min-w-0">
                      <div class="mb-1 text-[11px] font-semibold text-text-weak">工具</div>
                      <div class="flex flex-wrap gap-1.5">
                        <For each={visibleTools()}>
                          {(tool) => (
                            <button
                              type="button"
                              class="rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1 text-[11px] text-text-base"
                              title={tool.id}
                              onClick={() => applyCapability("tool", tool.label)}
                            >
                              {tool.label}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                    <div class="min-w-0">
                      <div class="mb-1 text-[11px] font-semibold text-text-weak">Skills</div>
                      <div class="flex flex-wrap gap-1.5">
                        <For each={visibleSkills()}>
                          {(skill) => (
                            <button
                              type="button"
                              class="max-w-full truncate rounded-md border border-border-weak-base bg-surface-raised-base px-2 py-1 text-[11px] text-text-base"
                              title={skill.description}
                              onClick={() => applyCapability("skill", skill.name)}
                            >
                              {skill.name}
                            </button>
                          )}
                        </For>
                      </div>
                    </div>
                  </div>
                </Show>
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
