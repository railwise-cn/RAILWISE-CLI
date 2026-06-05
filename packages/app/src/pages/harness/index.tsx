import "@/pages/agents/agent-studio.css"
import { A } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import type { Message, Part, PermissionRequest, QuestionAnswer, QuestionRequest, Session, SessionStatus, Todo, ToolPart } from "@railwise/sdk/v2/client"
import { base64Encode } from "@railwise/util/encode"
import { DateTime } from "luxon"
import { Button } from "@railwise/ui/button"
import { Icon, type IconProps } from "@railwise/ui/icon"
import { showToast } from "@railwise/ui/toast"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useModels } from "@/context/models"
import { useServer } from "@/context/server"
import { useProviders } from "@/hooks/use-providers"
import { recommendedModel } from "@/pages/agents/collaboration"
import { repairInstruction, toolInputPreview, toolRecovery, toolTitle } from "./recovery"

type PermissionItem = {
  directory: string
  request: PermissionRequest
}

type Reply = "once" | "always" | "reject"

type ProjectStore = {
  directory: string
  store: ReturnType<ReturnType<typeof useGlobalSync>["child"]>[0]
}

type TimelineItem = {
  directory: string
  session: Session
  status: SessionStatus
  messages: Message[]
  permissions: PermissionRequest[]
  questions: QuestionRequest[]
  todo: Todo[]
  parts: ToolPart[]
  tools: {
    running: number
    errored: number
    completed: number
  }
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function projectName(value: string) {
  const clean = value.trim().replaceAll("\\", "/").replace(/\/+$/, "")
  const parts = clean.split("/").filter(Boolean)
  return parts.at(-1) ?? "打开项目"
}

function metadata(request: PermissionRequest) {
  return Object.entries(request.metadata ?? {})
    .filter((entry) => entry[1] !== undefined && entry[1] !== null)
    .map((entry) => ({
      key: entry[0],
      value: typeof entry[1] === "object" ? JSON.stringify(entry[1]) : String(entry[1]),
    }))
    .slice(0, 3)
}

function statusLabel(status: SessionStatus) {
  if (status.type === "busy") return "运行中"
  if (status.type === "retry") return `重试中 ${status.attempt}`
  return "空闲"
}

function timelineLabel(item: TimelineItem) {
  if (item.permissions.length > 0) return `${item.permissions.length} 个权限待审批`
  if (item.questions.length > 0) return `${item.questions.length} 个问题待回答`
  if (item.tools.running > 0) return `${item.tools.running} 个工具运行中`
  if (item.tools.errored > 0) return `${item.tools.errored} 个工具失败`
  const active = item.todo.filter((todo) => todo.status === "in_progress").length
  if (active > 0) return `${active} 个任务进行中`
  const pending = item.todo.filter((todo) => todo.status === "pending").length
  if (pending > 0) return `${pending} 个任务待处理`
  if (item.tools.completed > 0) return `${item.tools.completed} 个工具已完成`
  return "等待下一步输入"
}

function key(item: TimelineItem) {
  return `${item.directory}:${item.session.id}`
}

function sessionHref(directory: string, sessionID: string, target?: string) {
  const href = `/${base64Encode(directory)}/session/${sessionID}`
  if (!target) return href
  return `${href}#${target}`
}

function promptTarget() {
  return "session-prompt-dock"
}

function toolTarget(item: TimelineItem, part: ToolPart) {
  const message = item.messages.find((candidate) => candidate.id === part.messageID)
  if (!message) return promptTarget()
  if (message.role === "assistant") return `message-${message.parentID}`
  return `message-${message.id}`
}

function sessionTarget(item: TimelineItem) {
  if (item.permissions.length > 0 || item.questions.length > 0) return promptTarget()
  const failed = item.parts.find((part) => part.state.status === "error")
  if (failed) return toolTarget(item, failed)
  const user = item.messages.filter((message) => message.role === "user").at(-1)
  if (user) return `message-${user.id}`
  return promptTarget()
}

function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool"
}

function state(part: ToolPart) {
  if (part.state.status === "pending") return "等待中"
  if (part.state.status === "running") return "运行中"
  if (part.state.status === "error") return "失败"
  return "完成"
}

function duration(part: ToolPart) {
  if (part.state.status === "pending") return ""
  const end = part.state.status === "running" ? Date.now() : part.state.time.end
  const value = Math.max(0, end - part.state.time.start)
  if (value < 1000) return `${value}ms`
  return `${Math.round(value / 100) / 10}s`
}

function todoLabel(todo: Todo) {
  if (todo.status === "in_progress") return "进行中"
  if (todo.status === "completed") return "完成"
  if (todo.status === "cancelled") return "取消"
  return "待处理"
}

export default function HarnessPage() {
  const sync = useGlobalSync()
  const sdk = useGlobalSDK()
  const layout = useLayout()
  const server = useServer()
  const providers = useProviders()
  const models = useModels()
  const [focus, setFocus] = createSignal<string>()
  const [responding, setResponding] = createSignal<Record<string, boolean>>({})
  const [answering, setAnswering] = createSignal<Record<string, boolean>>({})
  const [repairing, setRepairing] = createSignal<Record<string, boolean>>({})
  const [answers, setAnswers] = createSignal<Record<string, QuestionAnswer[]>>({})
  const [custom, setCustom] = createSignal<Record<string, string>>({})
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const recent = createMemo(() =>
    sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5),
  )
  const stores = createMemo<ProjectStore[]>(() => {
    const seen = new Set<string>()
    return recent().flatMap((project) => {
      if (!project.worktree || seen.has(project.worktree)) return []
      seen.add(project.worktree)
      return [{ directory: project.worktree, store: sync.child(project.worktree)[0] }]
    })
  })
  const permissions = createMemo<PermissionItem[]>(() =>
    stores().flatMap((project) =>
      Object.values(project.store.permission).flatMap((requests) =>
        requests.map((request) => ({
          directory: project.directory,
          request,
        })),
      ),
    ),
  )
  const timeline = createMemo<TimelineItem[]>(() =>
    stores()
      .flatMap((project) =>
        project.store.session.map((session) => {
          const parts = Object.values(project.store.part)
            .flat()
            .filter((part): part is ToolPart => part.sessionID === session.id && isToolPart(part))
          return {
            directory: project.directory,
            session,
            status: project.store.session_status[session.id] ?? { type: "idle" as const },
            messages: project.store.message[session.id] ?? [],
            permissions: project.store.permission[session.id] ?? [],
            questions: project.store.question[session.id] ?? [],
            todo: project.store.todo[session.id] ?? [],
            parts,
            tools: {
              running: parts.filter((part) => part.state.status === "running").length,
              errored: parts.filter((part) => part.state.status === "error").length,
              completed: parts.filter((part) => part.state.status === "completed").length,
            },
          }
        }),
      )
      .sort((a, b) => b.session.time.updated - a.session.time.updated)
      .slice(0, 8),
  )
  const recoveries = createMemo(() =>
    timeline()
      .flatMap((item) =>
        item.parts
          .filter((part) => part.state.status === "error")
          .map((part) => ({
            item,
            part,
            recovery: toolRecovery(part),
          })),
      )
      .slice(0, 6),
  )
  const selected = createMemo(() => timeline().find((item) => key(item) === focus()) ?? timeline()[0])
  const selectedKey = createMemo(() => {
    const item = selected()
    if (!item) return ""
    return key(item)
  })
  const mode = createMemo(() => (server.isLocal() ? "本地执行" : "远程连接"))
  const health = createMemo(() => {
    const value = server.healthy()
    if (value === true) return "服务在线"
    if (value === false) return "服务异常"
    return "连接中"
  })
  const model = createMemo(() => {
    const provider = connected()[0]
    if (provider) return `${provider.name} / ${recommendedModel}`
    const first = visible()[0]
    if (first) return `${first.provider.name} / ${first.name}`
    return `默认建议 ${recommendedModel}`
  })
  const gate = createMemo(() => (permissions().length > 0 ? `${permissions().length} 个待审批` : "本地安全模式"))
  const steps = createMemo<Array<{ icon: IconProps["name"]; title: string; value: string; description: string }>>(() => [
    {
      icon: "folder",
      title: "工作区边界",
      value: recent()[0] ? projectName(recent()[0].worktree) : "等待选择文件夹",
      description: "所有文件读写都绑定在用户选择的项目目录内。",
    },
    {
      icon: "brain",
      title: "模型路由",
      value: model(),
      description: "RAILWISE、审校、平差等智能体可以按任务绑定不同模型。",
    },
    {
      icon: "circle-ban-sign",
      title: "权限闸门",
      value: gate(),
      description: "高风险命令、外部目录和文件写入需要显式确认。",
    },
    {
      icon: "console",
      title: "工具执行",
      value: "可观测",
      description: "计划、工具调用、权限和产物会进入会话时间线。",
    },
  ])

  createEffect(() => {
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (!current) return
    layout.projects.open(current)
    if (server.projects.last() !== current) server.projects.touch(current)
  })

  function busy(request: PermissionRequest) {
    return responding()[request.id] ?? false
  }

  function pending(request: QuestionRequest) {
    return answering()[request.id] ?? false
  }

  function repairKey(part: ToolPart) {
    return `${part.sessionID}:${part.id}`
  }

  function repairingTool(part: ToolPart) {
    return repairing()[repairKey(part)] ?? false
  }

  function slot(request: QuestionRequest, index: number) {
    return `${request.id}:${index}`
  }

  function values(request: QuestionRequest, index: number) {
    return answers()[request.id]?.[index] ?? []
  }

  function typed(request: QuestionRequest, index: number) {
    return custom()[slot(request, index)] ?? ""
  }

  function ready(request: QuestionRequest) {
    return request.questions.length > 0 && request.questions.every((question, index) => result(request, index).length > 0)
  }

  function setValues(request: QuestionRequest, index: number, value: QuestionAnswer) {
    setAnswers((current) => ({
      ...current,
      [request.id]: request.questions.map((_, i) => (i === index ? value : (current[request.id]?.[i] ?? []))),
    }))
  }

  function pick(request: QuestionRequest, index: number, label: string, multiple: boolean | undefined) {
    if (!multiple) {
      setValues(request, index, [label])
      return
    }
    const list = values(request, index)
    setValues(request, index, list.includes(label) ? list.filter((item) => item !== label) : [...list, label])
  }

  function text(request: QuestionRequest, index: number, value: string) {
    setCustom((current) => ({ ...current, [slot(request, index)]: value }))
  }

  function result(request: QuestionRequest, index: number) {
    const input = typed(request, index).trim()
    const value = values(request, index)
    const question = request.questions[index]
    if (!input || question?.custom === false) return value
    if (!question?.multiple) return [input]
    if (value.includes(input)) return value
    return [...value, input]
  }

  function decide(item: PermissionItem, reply: Reply) {
    const id = item.request.id
    if (busy(item.request)) return
    setResponding((current) => ({ ...current, [id]: true }))
    void sdk.client.permission
      .reply({
        directory: item.directory,
        requestID: id,
        reply,
      })
      .catch((error) => {
        showToast({ title: "权限处理失败", description: message(error) })
      })
      .finally(() => {
        setResponding((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      })
  }

  function reply(directory: string, request: QuestionRequest) {
    if (pending(request) || !ready(request)) return
    setAnswering((current) => ({ ...current, [request.id]: true }))
    void sdk.client.question
      .reply({
        directory,
        requestID: request.id,
        answers: request.questions.map((_, index) => result(request, index)),
      })
      .catch((error) => {
        showToast({ title: "问题提交失败", description: message(error) })
      })
      .finally(() => {
        setAnswering((current) => {
          const next = { ...current }
          delete next[request.id]
          return next
        })
      })
  }

  function reject(directory: string, request: QuestionRequest) {
    if (pending(request)) return
    setAnswering((current) => ({ ...current, [request.id]: true }))
    void sdk.client.question
      .reject({
        directory,
        requestID: request.id,
      })
      .catch((error) => {
        showToast({ title: "问题拒绝失败", description: message(error) })
      })
      .finally(() => {
        setAnswering((current) => {
          const next = { ...current }
          delete next[request.id]
          return next
        })
      })
  }

  function repair(item: TimelineItem, part: ToolPart) {
    const id = repairKey(part)
    if (repairingTool(part)) return
    setRepairing((current) => ({ ...current, [id]: true }))
    void sdk.client.session
      .promptAsync({
        directory: item.directory,
        sessionID: item.session.id,
        agent: "chief_manager",
        parts: [
          {
            type: "text",
            text: repairInstruction(part),
          },
        ],
      })
      .then(() => {
        showToast({ title: "已发送修复指令", description: "智能体会在原会话里继续处理失败工具调用。" })
      })
      .catch((error) => {
        showToast({ title: "修复指令发送失败", description: message(error) })
      })
      .finally(() => {
        setRepairing((current) => {
          const next = { ...current }
          delete next[id]
          return next
        })
      })
  }

  return (
    <main class="agent-studio harness-page" data-testid="harness-page">
      <div class="harness-stack">
        <section class="harness-command-shell" data-testid="harness-shell">
          <aside class="harness-command-sidebar">
            <A href="/home" class="agent-brand">
              <span class="agent-brand__logo">
                <Icon name="server" size="small" />
              </span>
              <span>
                <strong>RAILWISE</strong>
                <small>执行中心</small>
              </span>
            </A>
            <nav class="harness-nav" aria-label="执行中心导航">
              <A href="/home">
                <Icon name="folder" size="small" />
                工作台
              </A>
              <A href="/agents">
                <Icon name="brain" size="small" />
                智能体
              </A>
              <A href="/marketplace">
                <Icon name="models" size="small" />
                能力市场
              </A>
            </nav>
          </aside>

          <section class="harness-command-main">
            <header class="agent-command-topbar">
              <A href="/home" class="agent-pill">
                <Icon name="folder" size="small" />
                工作台
              </A>
              <A href="/marketplace" class="agent-pill">
                <Icon name="models" size="small" />
                能力市场
              </A>
            </header>
            <div class="harness-hero-card">
              <span class="agent-kicker">RAILWISE 执行中心</span>
              <h1>执行中心</h1>
              <p>处理权限确认、失败恢复与会话执行状态。</p>
            </div>
            <div class="harness-metrics">
              <div>
                <span>模式</span>
                <strong>{mode()}</strong>
                <small>{health()}</small>
              </div>
              <div>
                <span>待处理</span>
                <strong>{permissions().length + recoveries().length}</strong>
                <small>{gate()}</small>
              </div>
              <div>
                <span>会话</span>
                <strong>{timeline().length}</strong>
                <small>{timeline().length > 0 ? "最近执行记录" : "等待首次协作"}</small>
              </div>
            </div>
          </section>

          <aside class="harness-command-inspector">
            <section class="agent-inspector-card">
              <div class="agent-inspector-card__line">
                <Icon name="models" size="small" />
                <span>模型</span>
              </div>
              <strong>{model()}</strong>
              <small>{connected().length ? "已接入 Provider" : "待接入 Provider"}</small>
            </section>
            <For each={steps()}>
              {(item) => (
                <section class="agent-inspector-card">
                  <div class="agent-inspector-card__line">
                    <Icon name={item.icon} size="small" />
                    <span>{item.title}</span>
                  </div>
                  <strong>{item.value}</strong>
                  <small>{item.description}</small>
                </section>
              )}
            </For>
          </aside>
        </section>

        <section class="rounded-lg border border-border-subtle bg-surface-panel p-4" data-testid="harness-permissions">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-15-medium text-text-strong">待审批动作</h2>
              <p class="mt-1 text-12-regular text-text-weak">这里集中处理智能体发起的高风险工具请求。</p>
            </div>
            <span class="rounded-md bg-surface-element px-2 py-1 text-12-medium text-text-weak">{gate()}</span>
          </div>

          <Show
            when={permissions().length > 0}
            fallback={<div class="rounded-md bg-surface-element px-3 py-4 text-13-regular text-text-weak">当前没有等待审批的动作。</div>}
          >
            <div class="grid gap-2">
              <For each={permissions()}>
                {(item) => (
                  <div class="rounded-md border border-border-subtle bg-surface-element p-3" data-testid="harness-permission-item">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="text-13-medium text-text-strong">{item.request.permission}</span>
                          <span class="text-12-mono text-text-weak">{item.request.sessionID}</span>
                        </div>
                        <div class="mt-1 truncate text-12-mono text-text-weak" title={item.directory}>
                          {projectName(item.directory)}
                        </div>
                      </div>
                      <A
                        href={sessionHref(item.directory, item.request.sessionID, promptTarget())}
                        data-testid="harness-permission-open-session"
                        class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-panel"
                      >
                        定位处理
                      </A>
                    </div>

                    <Show when={item.request.patterns.length > 0}>
                      <div class="mt-3 flex flex-wrap gap-2">
                        <For each={item.request.patterns}>
                          {(pattern) => <code class="rounded bg-surface-panel px-2 py-1 text-12-mono text-text-strong break-all">{pattern}</code>}
                        </For>
                      </div>
                    </Show>

                    <Show when={metadata(item.request).length > 0}>
                      <div class="mt-3 grid gap-1 text-12-regular text-text-weak">
                        <For each={metadata(item.request)}>
                          {(entry) => (
                            <div class="flex gap-2">
                              <span class="shrink-0 text-text-strong">{entry.key}</span>
                              <span class="truncate">{entry.value}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>

                    <div class="mt-3 flex flex-wrap justify-end gap-2">
                      <Button variant="ghost" size="small" disabled={busy(item.request)} onClick={() => decide(item, "reject")}>
                        拒绝
                      </Button>
                      <Button
                        variant="secondary"
                        size="small"
                        disabled={busy(item.request) || item.request.always.length === 0}
                        onClick={() => decide(item, "always")}
                      >
                        始终允许
                      </Button>
                      <Button variant="primary" size="small" disabled={busy(item.request)} onClick={() => decide(item, "once")}>
                        允许一次
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="rounded-lg border border-border-subtle bg-surface-panel p-4" data-testid="harness-recovery-queue">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-15-medium text-text-strong">失败恢复队列</h2>
              <p class="mt-1 text-12-regular text-text-weak">优先处理最近失败的工具调用，按失败原因给出恢复方向。</p>
            </div>
            <span class="rounded-md bg-surface-element px-2 py-1 text-12-medium text-text-weak">{recoveries().length} 个失败项</span>
          </div>

          <Show
            when={recoveries().length > 0}
            fallback={<div class="rounded-md bg-surface-element px-3 py-4 text-13-regular text-text-weak">当前没有需要恢复的失败工具。</div>}
          >
            <div class="grid gap-2">
              <For each={recoveries()}>
                {(entry) => (
                  <div class="rounded-md border border-border-subtle bg-surface-element p-3" data-testid="harness-recovery-item">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div class="min-w-0">
                        <div class="flex flex-wrap items-center gap-2">
                          <span class="rounded bg-surface-panel px-2 py-0.5 text-11-medium text-text-weak">{entry.recovery.label}</span>
                          <span class="truncate text-13-medium text-text-strong">{entry.item.session.title || "未命名会话"}</span>
                        </div>
                        <div class="mt-1 truncate text-12-regular text-text-weak">
                          {toolTitle(entry.part)} · {entry.recovery.summary}
                        </div>
                      </div>
                      <div class="flex shrink-0 gap-2">
                        <A
                          href={sessionHref(entry.item.directory, entry.item.session.id, toolTarget(entry.item, entry.part))}
                          data-testid="harness-recovery-open-session"
                          class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-panel"
                        >
                          定位消息
                        </A>
                        <Button variant="primary" size="small" disabled={repairingTool(entry.part)} onClick={() => repair(entry.item, entry.part)}>
                          {repairingTool(entry.part) ? "发送中" : "继续修复"}
                        </Button>
                      </div>
                    </div>
                    <Show when={entry.part.state.status === "error" ? entry.part.state.error : ""}>
                      {(error) => <div class="mt-2 line-clamp-2 break-words text-12-regular text-text-danger-base">{error()}</div>}
                    </Show>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="rounded-lg border border-border-subtle bg-surface-panel p-4" data-testid="harness-timeline">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-15-medium text-text-strong">执行时间线</h2>
              <p class="mt-1 text-12-regular text-text-weak">按最近项目聚合会话状态、权限、问题、任务和工具执行。</p>
            </div>
            <span class="rounded-md bg-surface-element px-2 py-1 text-12-medium text-text-weak">最近 {timeline().length} 条</span>
          </div>

          <Show
            when={timeline().length > 0}
            fallback={<div class="rounded-md bg-surface-element px-3 py-4 text-13-regular text-text-weak">还没有会话执行记录。</div>}
          >
            <div class="grid gap-2">
              <For each={timeline()}>
                {(item) => (
                  <div
                    class="rounded-md border border-border-subtle bg-surface-element p-3"
                    classList={{ "border-border-weak-base bg-surface-raised-base": key(item) === selectedKey() }}
                    data-testid="harness-timeline-item"
                  >
                    <button type="button" class="block w-full text-left" onClick={() => setFocus(key(item))}>
                      <div class="flex flex-wrap items-start justify-between gap-3">
                        <div class="min-w-0">
                          <div class="flex flex-wrap items-center gap-2">
                            <span class="truncate text-13-medium text-text-strong">{item.session.title || "未命名会话"}</span>
                            <span class="rounded bg-surface-panel px-2 py-0.5 text-11-medium text-text-weak">{statusLabel(item.status)}</span>
                          </div>
                          <div class="mt-1 truncate text-12-mono text-text-weak" title={item.directory}>
                            {projectName(item.directory)}
                          </div>
                        </div>
                        <div class="text-right text-12-regular text-text-weak">
                          {DateTime.fromMillis(item.session.time.updated).toRelative()}
                        </div>
                      </div>
                    </button>
                    <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-12-regular text-text-weak">
                      <div class="flex flex-wrap gap-2">
                        <span class="rounded bg-surface-panel px-2 py-1">{timelineLabel(item)}</span>
                        <Show when={item.session.summary}>
                          {(summary) => (
                            <span class="rounded bg-surface-panel px-2 py-1">
                              {summary().files} 文件 / +{summary().additions} / -{summary().deletions}
                            </span>
                          )}
                        </Show>
                      </div>
                      <A
                        href={sessionHref(item.directory, item.session.id, sessionTarget(item))}
                        data-testid="harness-timeline-open-session"
                        class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-panel"
                      >
                        定位会话
                      </A>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="rounded-lg border border-border-subtle bg-surface-panel p-4" data-testid="harness-session-detail">
          <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 class="text-15-medium text-text-strong">会话执行详情</h2>
              <p class="mt-1 text-12-regular text-text-weak">查看单次协作里的待办、权限、问题和工具调用。</p>
            </div>
            <Show when={selected()}>
              {(item) => (
                <A
                  href={sessionHref(item().directory, item().session.id, sessionTarget(item()))}
                  data-testid="harness-detail-open-session"
                  class="rounded-md border border-border-subtle px-3 py-2 text-13-medium text-text-strong hover:bg-surface-element"
                >
                  定位会话
                </A>
              )}
            </Show>
          </div>

          <Show
            when={selected()}
            fallback={<div class="rounded-md bg-surface-element px-3 py-4 text-13-regular text-text-weak">还没有可查看的会话。</div>}
          >
            {(item) => (
              <div class="grid gap-3">
                <div class="rounded-md bg-surface-element p-3">
                  <div class="flex flex-wrap items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="truncate text-14-medium text-text-strong">{item().session.title || "未命名会话"}</span>
                        <span class="rounded bg-surface-panel px-2 py-0.5 text-11-medium text-text-weak">{statusLabel(item().status)}</span>
                      </div>
                      <div class="mt-1 truncate text-12-mono text-text-weak" title={item().directory}>
                        {projectName(item().directory)}
                      </div>
                    </div>
                    <div class="text-right text-12-regular text-text-weak">
                      {DateTime.fromMillis(item().session.time.updated).toRelative()}
                    </div>
                  </div>
                  <div class="mt-3 flex flex-wrap gap-2 text-12-regular text-text-weak">
                    <span class="rounded bg-surface-panel px-2 py-1">{item().permissions.length} 权限</span>
                    <span class="rounded bg-surface-panel px-2 py-1">{item().questions.length} 问题</span>
                    <span class="rounded bg-surface-panel px-2 py-1">{item().todo.length} 待办</span>
                    <span class="rounded bg-surface-panel px-2 py-1">{item().parts.length} 工具调用</span>
                  </div>
                </div>

                <div class="grid gap-3 lg:grid-cols-2">
                  <div class="rounded-md border border-border-subtle bg-surface-element p-3">
                    <div class="mb-2 flex items-center justify-between">
                      <h3 class="text-13-medium text-text-strong">当前待办</h3>
                      <span class="text-12-regular text-text-weak">{item().todo.filter((todo) => todo.status === "completed").length}/{item().todo.length}</span>
                    </div>
                    <Show when={item().todo.length > 0} fallback={<div class="text-13-regular text-text-weak">暂无待办。</div>}>
                      <div class="grid gap-1.5">
                        <For each={item().todo.slice(0, 6)}>
                          {(todo) => (
                            <div class="flex gap-2 rounded bg-surface-panel px-2 py-1.5 text-12-regular">
                              <span class="shrink-0 text-text-weak">{todoLabel(todo)}</span>
                              <span class="min-w-0 break-words text-text-strong">{todo.content}</span>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>

                  <div class="rounded-md border border-border-subtle bg-surface-element p-3">
                    <div class="mb-2 flex items-center justify-between">
                      <h3 class="text-13-medium text-text-strong">等待人工介入</h3>
                      <span class="text-12-regular text-text-weak">{item().permissions.length + item().questions.length}</span>
                    </div>
                    <Show
                      when={item().permissions.length + item().questions.length > 0}
                      fallback={<div class="text-13-regular text-text-weak">没有等待处理的权限或问题。</div>}
                    >
                      <div class="grid gap-2">
                        <For each={item().permissions}>
                          {(request) => (
                            <div class="rounded bg-surface-panel p-2">
                              <div class="flex flex-wrap items-center justify-between gap-2">
                                <div class="text-12-medium text-text-strong">{request.permission}</div>
                                <div class="flex gap-1">
                                  <Button variant="ghost" size="small" disabled={busy(request)} onClick={() => decide({ directory: item().directory, request }, "reject")}>
                                    拒绝
                                  </Button>
                                  <Button variant="primary" size="small" disabled={busy(request)} onClick={() => decide({ directory: item().directory, request }, "once")}>
                                    允许
                                  </Button>
                                </div>
                              </div>
                              <Show when={request.patterns[0]}>
                                {(pattern) => <div class="mt-1 truncate text-12-mono text-text-weak">{pattern()}</div>}
                              </Show>
                            </div>
                          )}
                        </For>
                        <For each={item().questions}>
                          {(request) => (
                            <div class="rounded bg-surface-panel p-2">
                              <div class="mb-2 flex flex-wrap items-center justify-between gap-2">
                                <div class="text-12-medium text-text-strong">{request.questions[0]?.header ?? "待回答问题"}</div>
                                <div class="flex gap-1">
                                  <Button variant="ghost" size="small" disabled={pending(request)} onClick={() => reject(item().directory, request)}>
                                    拒绝
                                  </Button>
                                  <Button variant="primary" size="small" disabled={pending(request) || !ready(request)} onClick={() => reply(item().directory, request)}>
                                    提交
                                  </Button>
                                </div>
                              </div>
                              <div class="grid gap-2">
                                <For each={request.questions}>
                                  {(question, index) => (
                                    <div class="rounded border border-border-subtle bg-surface-element p-2">
                                      <div class="flex flex-wrap items-center gap-2">
                                        <span class="text-12-medium text-text-strong">{question.header}</span>
                                        <span class="rounded bg-surface-panel px-1.5 py-0.5 text-11-regular text-text-weak">
                                          {question.multiple ? "多选" : "单选"}
                                        </span>
                                      </div>
                                      <div class="mt-1 text-12-regular text-text-weak">{question.question}</div>
                                      <Show when={question.options.length > 0}>
                                        <div class="mt-2 flex flex-wrap gap-1.5">
                                          <For each={question.options}>
                                            {(option) => (
                                              <button
                                                type="button"
                                                disabled={pending(request)}
                                                class="rounded-md border border-border-subtle px-2 py-1 text-left text-12-regular text-text-strong hover:bg-surface-panel disabled:opacity-50"
                                                classList={{ "bg-surface-raised-base border-border-weak-base": values(request, index()).includes(option.label) }}
                                                onClick={() => pick(request, index(), option.label, question.multiple)}
                                              >
                                                <span>{option.label}</span>
                                                <Show when={option.description}>
                                                  <span class="ml-1 text-text-weak">{option.description}</span>
                                                </Show>
                                              </button>
                                            )}
                                          </For>
                                        </div>
                                      </Show>
                                      <Show when={question.custom !== false}>
                                        <textarea
                                          class="mt-2 min-h-16 w-full resize-y rounded-md border border-border-subtle bg-surface-panel px-2 py-1.5 text-12-regular text-text-strong outline-none placeholder:text-text-weak disabled:opacity-50"
                                          disabled={pending(request)}
                                          placeholder="补充回答..."
                                          value={typed(request, index())}
                                          onInput={(event) => text(request, index(), event.currentTarget.value)}
                                        />
                                      </Show>
                                    </div>
                                  )}
                                </For>
                              </div>
                            </div>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                </div>

                <div class="rounded-md border border-border-subtle bg-surface-element p-3">
                  <div class="mb-2 flex items-center justify-between">
                    <h3 class="text-13-medium text-text-strong">工具调用</h3>
                    <span class="text-12-regular text-text-weak">{item().parts.length}</span>
                  </div>
                  <Show when={item().parts.length > 0} fallback={<div class="text-13-regular text-text-weak">暂无工具调用。</div>}>
                    <div class="grid gap-2">
                      <For each={item().parts.slice(-8).reverse()}>
                        {(part) => (
                          <div class="rounded bg-surface-panel p-2">
                            <div class="flex flex-wrap items-center justify-between gap-2">
                              <div class="min-w-0">
                                <div class="truncate text-12-medium text-text-strong">{toolTitle(part)}</div>
                                <div class="mt-0.5 text-12-mono text-text-weak">{part.tool}</div>
                              </div>
                              <div class="shrink-0 text-right text-12-regular text-text-weak">
                                <div>{state(part)}</div>
                                <Show when={duration(part)}>
                                  {(value) => <div>{value()}</div>}
                                </Show>
                              </div>
                            </div>
                            <Show when={toolInputPreview(part.state.input)}>
                              {(value) => <div class="mt-1 truncate text-12-mono text-text-weak">{value()}</div>}
                            </Show>
                            <Show when={part.state.status === "error" ? part.state.error : ""}>
                              {(error) => <div class="mt-1 break-words text-12-regular text-text-danger-base">{error()}</div>}
                            </Show>
                            <Show when={part.state.status === "error"}>
                              <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                                <span class="rounded bg-surface-element px-2 py-1 text-12-medium text-text-weak">{toolRecovery(part).label}</span>
                                <A
                                  href={sessionHref(item().directory, item().session.id, toolTarget(item(), part))}
                                  data-testid="harness-tool-open-session"
                                  class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-element"
                                >
                                  定位消息
                                </A>
                                <Button variant="primary" size="small" disabled={repairingTool(part)} onClick={() => repair(item(), part)}>
                                  {repairingTool(part) ? "发送中" : "继续修复"}
                                </Button>
                              </div>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
            )}
          </Show>
        </section>

        <section class="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div class="rounded-lg border border-border-subtle bg-surface-panel p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-15-medium text-text-strong">执行链路</h2>
              <span class="text-12-regular text-text-weak">计划 / 权限 / 工具 / 产物</span>
            </div>
            <div class="grid gap-2">
              <For each={steps()}>
                {(item) => (
                  <div class="flex gap-3 rounded-md border border-border-subtle bg-surface-element p-3">
                    <div class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md bg-surface-panel">
                      <Icon name={item.icon} size="small" />
                    </div>
                    <div class="min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-13-medium text-text-strong">{item.title}</span>
                        <span class="truncate text-12-regular text-text-weak">{item.value}</span>
                      </div>
                      <div class="mt-1 text-12-regular text-text-weak">{item.description}</div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>

          <aside class="rounded-lg border border-border-subtle bg-surface-panel p-4">
            <div class="mb-3 flex items-center justify-between">
              <h2 class="text-15-medium text-text-strong">最近工作区</h2>
              <A href="/home" class="text-12-medium text-text-interactive-base">
                选择
              </A>
            </div>
            <Show when={recent().length > 0} fallback={<div class="text-13-regular text-text-weak">还没有最近项目。</div>}>
              <div class="flex flex-col gap-2">
                <For each={recent()}>
                  {(project) => (
                    <div class="rounded-md bg-surface-element px-3 py-2">
                      <div class="truncate text-13-medium text-text-strong" title={project.worktree}>{projectName(project.worktree)}</div>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </aside>
        </section>
      </div>
    </main>
  )
}
