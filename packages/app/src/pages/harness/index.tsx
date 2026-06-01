import { A } from "@solidjs/router"
import { createMemo, createSignal, For, Show } from "solid-js"
import type { Part, PermissionRequest, QuestionRequest, Session, SessionStatus, Todo, ToolPart } from "@railwise/sdk/v2/client"
import { base64Encode } from "@railwise/util/encode"
import { DateTime } from "luxon"
import { Button } from "@railwise/ui/button"
import { Icon, type IconProps } from "@railwise/ui/icon"
import { showToast } from "@railwise/ui/toast"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useModels } from "@/context/models"
import { useServer } from "@/context/server"
import { useProviders } from "@/hooks/use-providers"
import { recommendedModel } from "@/pages/agents/collaboration"

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

function compact(value: string, home: string) {
  if (home && value === home) return "~"
  if (home && value.startsWith(home + "/")) return "~" + value.slice(home.length)
  return value
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

function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool"
}

function state(part: ToolPart) {
  if (part.state.status === "pending") return "等待中"
  if (part.state.status === "running") return "运行中"
  if (part.state.status === "error") return "失败"
  return "完成"
}

function title(part: ToolPart) {
  if (part.state.status === "running" && part.state.title) return part.state.title
  if (part.state.status === "completed") return part.state.title
  return part.tool
}

function duration(part: ToolPart) {
  if (part.state.status === "pending") return ""
  const end = part.state.status === "running" ? Date.now() : part.state.time.end
  const value = Math.max(0, end - part.state.time.start)
  if (value < 1000) return `${value}ms`
  return `${Math.round(value / 100) / 10}s`
}

function preview(value: unknown) {
  if (value === undefined || value === null) return ""
  const text = typeof value === "string" ? value : JSON.stringify(value)
  if (text.length <= 120) return text
  return text.slice(0, 117) + "..."
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
  const server = useServer()
  const providers = useProviders()
  const models = useModels()
  const [focus, setFocus] = createSignal<string>()
  const [responding, setResponding] = createSignal<Record<string, boolean>>({})
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
      value: recent()[0]?.worktree ?? "等待选择文件夹",
      description: "所有文件读写都绑定在用户选择的项目目录内。",
    },
    {
      icon: "brain",
      title: "模型路由",
      value: model(),
      description: "主控、审校、平差等智能体可以按任务绑定不同模型。",
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

  function busy(request: PermissionRequest) {
    return responding()[request.id] ?? false
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

  return (
    <main class="min-h-full px-6 py-5" data-testid="harness-page">
      <div class="mx-auto flex max-w-6xl flex-col gap-4">
        <section class="rounded-lg border border-border-subtle bg-surface-panel p-5">
          <div class="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div class="text-12-medium uppercase text-text-weak">RAILWISE Harness</div>
              <h1 class="mt-2 text-26-bold text-text-strong">执行层状态</h1>
              <p class="mt-2 max-w-2xl text-13-regular text-text-weak">
                Harness 负责工作区边界、模型路由、工具权限和执行事件，让桌面端不是简单套壳，而是可控的本地 AI 工作台。
              </p>
            </div>
            <div class="flex gap-2">
              <A href="/home" class="rounded-md border border-border-subtle px-3 py-2 text-13-medium text-text-strong hover:bg-surface-element">
                工作台
              </A>
              <A href="/marketplace" class="rounded-md border border-border-subtle px-3 py-2 text-13-medium text-text-strong hover:bg-surface-element">
                能力市场
              </A>
            </div>
          </div>
        </section>

        <section class="grid gap-3 md:grid-cols-3">
          <div class="rounded-lg border border-border-subtle bg-surface-panel p-4">
            <div class="text-12-medium text-text-weak">模式</div>
            <div class="mt-2 text-18-medium text-text-strong">{mode()}</div>
            <div class="mt-1 text-12-regular text-text-weak">{health()}</div>
          </div>
          <div class="rounded-lg border border-border-subtle bg-surface-panel p-4">
            <div class="text-12-medium text-text-weak">模型</div>
            <div class="mt-2 truncate text-18-medium text-text-strong">{model()}</div>
            <div class="mt-1 text-12-regular text-text-weak">{connected().length ? "已接入 Provider" : "待接入 Provider"}</div>
          </div>
          <div class="rounded-lg border border-border-subtle bg-surface-panel p-4">
            <div class="text-12-medium text-text-weak">能力集</div>
            <div class="mt-2 text-18-medium text-text-strong">智能体 / 工具 / Skills</div>
            <div class="mt-1 text-12-regular text-text-weak">由能力市场统一管理</div>
          </div>
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
                          {compact(item.directory, sync.data.path.home)}
                        </div>
                      </div>
                      <A
                        href={`/${base64Encode(item.directory)}/session/${item.request.sessionID}`}
                        class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-panel"
                      >
                        打开会话
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
                            {compact(item.directory, sync.data.path.home)}
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
                        href={`/${base64Encode(item.directory)}/session/${item.session.id}`}
                        class="rounded-md border border-border-subtle px-2 py-1 text-12-medium text-text-strong hover:bg-surface-panel"
                      >
                        打开会话
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
                  href={`/${base64Encode(item().directory)}/session/${item().session.id}`}
                  class="rounded-md border border-border-subtle px-3 py-2 text-13-medium text-text-strong hover:bg-surface-element"
                >
                  进入对话
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
                        {compact(item().directory, sync.data.path.home)}
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
                              <div class="text-12-medium text-text-strong">{request.questions[0]?.header ?? "待回答问题"}</div>
                              <div class="mt-1 line-clamp-2 text-12-regular text-text-weak">{request.questions[0]?.question ?? "打开会话继续处理。"}</div>
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
                                <div class="truncate text-12-medium text-text-strong">{title(part)}</div>
                                <div class="mt-0.5 text-12-mono text-text-weak">{part.tool}</div>
                              </div>
                              <div class="shrink-0 text-right text-12-regular text-text-weak">
                                <div>{state(part)}</div>
                                <Show when={duration(part)}>
                                  {(value) => <div>{value()}</div>}
                                </Show>
                              </div>
                            </div>
                            <Show when={preview(part.state.input)}>
                              {(value) => <div class="mt-1 truncate text-12-mono text-text-weak">{value()}</div>}
                            </Show>
                            <Show when={part.state.status === "error" ? part.state.error : ""}>
                              {(error) => <div class="mt-1 break-words text-12-regular text-text-danger-base">{error()}</div>}
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
                      <div class="truncate text-12-mono text-text-strong">{project.worktree}</div>
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
