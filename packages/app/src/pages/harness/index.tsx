import { A } from "@solidjs/router"
import { createMemo, For, Show } from "solid-js"
import { Icon, type IconProps } from "@railwise/ui/icon"
import { useGlobalSync } from "@/context/global-sync"
import { useModels } from "@/context/models"
import { useServer } from "@/context/server"
import { useProviders } from "@/hooks/use-providers"
import { recommendedModel } from "@/pages/agents/collaboration"

export default function HarnessPage() {
  const sync = useGlobalSync()
  const server = useServer()
  const providers = useProviders()
  const models = useModels()
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const recent = createMemo(() =>
    sync.data.project
      .slice()
      .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
      .slice(0, 5),
  )
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
      value: "本地安全模式",
      description: "高风险命令、外部目录和文件写入需要显式确认。",
    },
    {
      icon: "console",
      title: "工具执行",
      value: "可观测",
      description: "计划、工具调用、权限和产物会进入会话时间线。",
    },
  ])

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
