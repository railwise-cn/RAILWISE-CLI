import "./workbench.css"
import { A, useNavigate } from "@solidjs/router"
import { base64Encode } from "@railwise/util/encode"
import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useModels, type ModelKey } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useProviders } from "@/hooks/use-providers"
import { collaborationTarget } from "@/pages/agents/collaboration"
import { setSessionHandoff } from "@/pages/session/handoff"
import {
  compactPath,
  capabilitySummary,
  defaultAgent,
  emptyPrompt,
  enabledCapabilityNames,
  harnessModelLabel,
  modelLabel,
  primaryActionLabel,
  promptExamples,
  primarySessionID,
  recentSessions,
  recentWorkspaces,
  resumeActionLabel,
  runtimeLabel,
  sessionRuntimeLabel,
  sessionTitle,
} from "./workbench-state"

const agents = [
  { value: "chief_manager", label: "睿威主控", note: "拆解任务、调度专业能力" },
  { value: "cpiii_specialist", label: "线路复测专家", note: "CPⅢ、控制网与复测资料" },
  { value: "adjustment_computer", label: "平差计算专家", note: "观测数据、平差与成果检查" },
  { value: "norm_librarian", label: "规范资料员", note: "规范条文、交付清单与引用" },
] as const

const modeLabel = {
  safe: "本地安全模式",
  ask: "等待确认",
  auto: "自动执行",
} as const

const time = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
})

export default function WorkbenchPage() {
  const dialog = useDialog()
  const layout = useLayout()
  const navigate = useNavigate()
  const platform = usePlatform()
  const server = useServer()
  const sdk = useGlobalSDK()
  const sync = useGlobalSync()
  const models = useModels()
  const providers = useProviders()
  const [directory, setDirectory] = createSignal("")
  const [manual, setManual] = createSignal(false)
  const [agent, setAgent] = createSignal(defaultAgent)
  const [draft, setDraft] = createSignal("")
  const [status] = createResource(directory, (value) =>
    sdk.client.harness
      .status(value ? { directory: value } : undefined)
      .then((result) => result.data)
      .catch(() => undefined),
  )
  const [capabilities] = createResource(() =>
    sdk.client.marketplace.capabilities
      .list()
      .then((result) => result.data?.data ?? [])
      .catch(() => []),
  )

  const recent = createMemo(() => recentWorkspaces(sync.data.project, 5))
  const hasWorkspace = createMemo(() => directory().trim().length > 0)
  const hasPrompt = createMemo(() => draft().trim().length > 0)
  const workspace = createMemo(() => compactPath({ value: directory(), home: sync.data.path.home }))
  const workspaceStore = createMemo(() => (hasWorkspace() ? sync.child(directory())[0] : undefined))
  const sessions = createMemo(() => recentSessions(workspaceStore()?.session ?? []))
  const latest = createMemo(() => sessions()[0])
  const primarySession = createMemo(
    () =>
      sessions().find((session) => session.id === primarySessionID({ latestID: latest()?.id, runtime: status() })) ??
      latest(),
  )
  const selected = createMemo(() => agents.find((item) => item.value === agent()) ?? agents[0])
  const canStart = createMemo(() => hasWorkspace() && hasPrompt())
  const enabledCapabilities = createMemo(() => enabledCapabilityNames(capabilities() ?? []))
  const capability = createMemo(() =>
    capabilitySummary({
      count: status()?.capabilityCount ?? enabledCapabilities().length,
      loading: status.loading && capabilities.loading,
    }),
  )
  const permission = createMemo(() =>
    status()?.pendingPermissionCount ? `${status()!.pendingPermissionCount} 个请求等待处理` : "当前没有危险权限请求",
  )
  const configuredModel = () => {
    const value = sync.data.config.model
    if (!value) return undefined
    const [providerID, ...rest] = value.split("/")
    const modelID = rest.join("/")
    if (!providerID || !modelID) return undefined
    return { providerID, modelID }
  }
  const providerDefaultModel = () =>
    providers.connected().flatMap((provider) => {
      const modelID = providers.default()[provider.id] ?? Object.values(provider.models)[0]?.id
      return modelID ? [{ providerID: provider.id, modelID }] : []
    })[0]
  const currentModel = createMemo(() =>
    [configuredModel(), ...models.recent.list(), providerDefaultModel()]
      .filter((item): item is ModelKey => !!item)
      .map(models.find)
      .find(Boolean),
  )
  const currentModelLabel = createMemo(() => modelLabel(currentModel()))
  const harnessModel = createMemo(() =>
    harnessModelLabel({
      active: !!status()?.pendingPermissionCount || !!status()?.runningToolCount,
      fallback: currentModelLabel(),
      statusModel: status()?.model,
    }),
  )
  const runtime = createMemo(() => [
    { title: "会话准备", detail: hasWorkspace() ? workspace() : "选择资料目录后建立本地上下文", tone: "ready" },
    { title: "能力调度", detail: capability(), tone: "idle" },
    { title: "权限门禁", detail: permission(), tone: status()?.pendingPermissionCount ? "warn" : "safe" },
    {
      title: "工具执行",
      detail: status()?.runningToolCount ? `${status()!.runningToolCount} 个工具正在运行` : "当前无运行工具",
      tone: status()?.runningToolCount ? "ready" : "idle",
    },
  ])

  const updateDirectory = (value: string) => {
    setManual(true)
    setDirectory(value)
  }

  const chooseDirectory = async () => {
    const resolve = (value: string | string[] | null) => {
      const next = Array.isArray(value) ? value[0] : value
      if (next) updateDirectory(next)
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      resolve(
        await platform.openDirectoryPickerDialog({
          title: "选择资料目录",
          multiple: false,
        }),
      )
      return
    }
    dialog.show(
      () => <DialogSelectDirectory title="选择资料目录" onSelect={resolve} />,
      () => resolve(null),
    )
  }

  const startSession = () => {
    if (!canStart()) return
    const target = collaborationTarget({
      directory: directory(),
      agent: agent(),
      prompt: draft(),
    })
    layout.projects.open(target.directory)
    server.projects.touch(target.directory)
    setSessionHandoff(target.key, { prompt: target.prompt, autoSubmit: true })
    navigate(target.href)
  }

  const sessionHref = (sessionID: string) => `/${base64Encode(directory())}/session/${sessionID}`

  const primary = async () => {
    if (!hasWorkspace()) {
      await chooseDirectory()
      return
    }
    startSession()
  }

  createEffect(() => {
    if (manual() || directory()) return
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (current) setDirectory(current)
  })

  createEffect(() => {
    const current = directory()
    if (!current) return
    void sync.project.loadSessions(current)
  })

  return (
    <main class="workbench" data-testid="workbench-page">
      <aside class="workbench-sidebar" aria-label="工作区导航">
        <div class="workbench-brand">
          <span class="workbench-brand__mark">R</span>
          <div>
            <strong>RAILWISE</strong>
            <span>工程 AI 工作台</span>
          </div>
        </div>

        <button class="workbench-sidebar__primary" type="button" onClick={chooseDirectory}>
          选择资料目录
        </button>

        <section class="workbench-sidebar__section">
          <h2>当前工作区</h2>
          <Show when={hasWorkspace()} fallback={<p>{emptyPrompt({ hasWorkspace: false })}</p>}>
            <button class="workbench-workspace" type="button" onClick={() => updateDirectory(directory())}>
              <span>{workspace()}</span>
            </button>
          </Show>
        </section>

        <section class="workbench-sidebar__section">
          <h2>最近工作区</h2>
          <Show when={recent().length > 0} fallback={<p>还没有打开过资料目录。</p>}>
            <ul class="workbench-recent">
              <For each={recent()}>
                {(project) => (
                  <li>
                    <button type="button" onClick={() => updateDirectory(project.worktree)}>
                      {compactPath({ value: project.worktree, home: sync.data.path.home })}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>

        <nav class="workbench-nav" aria-label="扩展入口">
          <A href="/marketplace">能力市场</A>
          <A href="/harness">Harness</A>
          <A href="/agents">高级智能体设置</A>
        </nav>
      </aside>

      <section class="workbench-chat" aria-label="任务对话">
        <header class="workbench-chat__header">
          <div>
            <span>本地 Harness</span>
            <h1>告诉 RAILWISE 你想完成什么</h1>
          </div>
          <div class="workbench-model">
            <span>将使用模型</span>
            <strong>{currentModelLabel()}</strong>
          </div>
        </header>

        <form
          class="workbench-composer"
          onSubmit={(event) => {
            event.preventDefault()
            startSession()
          }}
        >
          <div class="workbench-composer__top">
            <label>
              协作智能体
              <select value={agent()} onChange={(event) => setAgent(event.currentTarget.value)}>
                <For each={agents}>{(item) => <option value={item.value}>{item.label}</option>}</For>
              </select>
            </label>
            <div class="workbench-agent-note">{selected().note}</div>
          </div>

          <textarea
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            placeholder="例如：检查当前线路复测资料，列出缺失文件并给出下一步执行计划。"
          />

          <div class="workbench-composer__actions">
            <span>{emptyPrompt({ hasWorkspace: hasWorkspace(), hasModel: true })}</span>
            <button type="button" disabled={hasWorkspace() && !hasPrompt()} onClick={primary}>
              {primaryActionLabel({ hasWorkspace: hasWorkspace() })}
            </button>
          </div>
        </form>

        <section class="workbench-prompts" aria-label="示例任务">
          <h2>可以这样开始</h2>
          <div>
            <For each={promptExamples}>
              {(prompt) => (
                <button type="button" onClick={() => setDraft(prompt)}>
                  {prompt}
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="workbench-results" aria-label="会话产物">
          <h2>会话产物</h2>
          <Show
            when={sessions().length > 0}
            fallback={<p>开始会话后，最近任务、工具调用和 Harness 轨迹会出现在这里。</p>}
          >
            <Show when={primarySession()}>
              {(session) => (
                <div class="workbench-resume">
                  <div>
                    <span>继续上次会话</span>
                    <strong>{sessionTitle(session())}</strong>
                    <small>
                      {runtimeLabel(status())} · {time.format(session().time.updated ?? session().time.created)} 更新
                    </small>
                  </div>
                  <A href={sessionHref(session().id)} data-state={status()?.pendingPermissionCount ? "warn" : "ready"}>
                    {resumeActionLabel(status())}
                  </A>
                </div>
              )}
            </Show>
            <ul class="workbench-sessions">
              <For each={sessions()}>
                {(session) => (
                  <li>
                    <A href={sessionHref(session.id)}>
                      <strong>{sessionTitle(session)}</strong>
                      <span class="workbench-session-meta">
                        <span>{time.format(session.time.updated ?? session.time.created)}</span>
                        <span
                          class="workbench-session-status"
                          data-testid="workbench-session-status"
                          data-state={session.id === latest()?.id ? "live" : "saved"}
                        >
                          {sessionRuntimeLabel({
                            sessionID: session.id,
                            latestID: latest()?.id,
                            runtime: status(),
                          })}
                        </span>
                      </span>
                    </A>
                    <A
                      href={`/harness?sessionID=${session.id}`}
                      aria-label={`查看 ${sessionTitle(session)} 的运行轨迹`}
                    >
                      轨迹
                    </A>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>
      </section>

      <aside class="workbench-context" aria-label="Harness 状态">
        <section>
          <h2>Harness</h2>
          <dl class="workbench-facts">
            <div>
              <dt>运行模式</dt>
              <dd>{status() ? modeLabel[status()!.mode] : "连接中"}</dd>
            </div>
            <div>
              <dt>模型</dt>
              <dd>{harnessModel()}</dd>
            </div>
            <div>
              <dt>工作区</dt>
              <dd>{hasWorkspace() ? workspace() : "等待选择资料目录"}</dd>
            </div>
            <div>
              <dt>权限状态</dt>
              <dd>{permission()}</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>能力集</h2>
          <p>{capability()}</p>
          <div class="workbench-capabilities">
            <Show when={enabledCapabilities().length > 0} fallback={<span>打开能力市场启用专业能力</span>}>
              <For each={enabledCapabilities()}>{(item) => <span>{item}</span>}</For>
            </Show>
          </div>
        </section>

        <section>
          <h2>运行轨迹</h2>
          <ol class="workbench-timeline">
            <For each={runtime()}>
              {(event) => (
                <li data-tone={event.tone}>
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                </li>
              )}
            </For>
          </ol>
        </section>
      </aside>
    </main>
  )
}
