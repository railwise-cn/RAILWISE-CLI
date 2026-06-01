import { A } from "@solidjs/router"
import { createMemo, createSignal, For, Show } from "solid-js"
import type { PermissionRequest } from "@railwise/sdk/v2/client"
import { base64Encode } from "@railwise/util/encode"
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

export default function HarnessPage() {
  const sync = useGlobalSync()
  const sdk = useGlobalSDK()
  const server = useServer()
  const providers = useProviders()
  const models = useModels()
  const [responding, setResponding] = createSignal<Record<string, boolean>>({})
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const recent = createMemo(() =>
    sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5),
  )
  const permissions = createMemo<PermissionItem[]>(() => {
    const seen = new Set<string>()
    return recent().flatMap((project) => {
      if (!project.worktree || seen.has(project.worktree)) return []
      seen.add(project.worktree)
      const child = sync.child(project.worktree)
      return Object.values(child[0].permission).flatMap((requests) =>
        requests.map((request) => ({
          directory: project.worktree,
          request,
        })),
      )
    })
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
