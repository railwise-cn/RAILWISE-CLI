import { Button } from "@railwise/ui/button"
import { showToast } from "@railwise/ui/toast"
import { useNavigate } from "@solidjs/router"
import { Component, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"
import type { AgentStudioItem } from "@/types/agent-studio"

export const SettingsAgents: Component = () => {
  const language = useLanguage()
  const sdk = useGlobalSDK()
  const dialog = useDialog()
  const navigate = useNavigate()
  const [items, setItems] = createSignal<AgentStudioItem[]>([])
  const [loading, setLoading] = createSignal(true)

  const text = (zh: string, en: string) => {
    const locale = language.locale()
    if (locale === "zh" || locale === "zht") return zh
    return en
  }

  const visible = createMemo(() => items().filter((item) => !item.hidden))
  const primary = createMemo(() => visible().filter((item) => item.mode === "primary").length)
  const subagent = createMemo(() => visible().filter((item) => item.mode === "subagent").length)
  const custom = createMemo(() => visible().filter((item) => item.filePath && !item.native).length)
  const sorted = createMemo(() =>
    visible()
      .slice()
      .sort((a, b) => {
        const diff = (b.callCount7d ?? 0) - (a.callCount7d ?? 0)
        if (diff) return diff
        return a.name.localeCompare(b.name)
      }),
  )

  const mode = (value: AgentStudioItem["mode"]) => {
    if (value === "primary") return text("主智能体", "Primary")
    if (value === "subagent") return text("子智能体", "Sub-agent")
    return text("全部", "All")
  }

  const load = () => {
    setLoading(true)
    sdk.client.agentStudio
      .list()
      .then((result) => setItems(result.data ?? []))
      .catch((err: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        }),
      )
      .finally(() => setLoading(false))
  }

  const open = (href: string) => {
    dialog.close()
    navigate(href)
  }

  onMount(load)

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-wrap items-start justify-between gap-4 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1 min-w-0">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.agents.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {text("查看当前智能体目录、热更新状态和最近调用量。", "Review agents, hot-reload sources, and recent calls.")}
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="large" variant="secondary" icon="arrow-up" disabled={loading()} onClick={load}>
              {loading() ? text("刷新中", "Refreshing") : text("刷新", "Refresh")}
            </Button>
            <Button size="large" variant="primary" icon="brain" onClick={() => open("/agents")}>
              {text("能力配置", "Configure")}
            </Button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <div class="grid grid-cols-4 gap-3">
          <Metric label={text("可见智能体", "Visible")} value={visible().length} />
          <Metric label={text("主智能体", "Primary")} value={primary()} />
          <Metric label={text("子智能体", "Sub-agents")} value={subagent()} />
          <Metric label={text("自定义", "Custom")} value={custom()} />
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-14-medium text-text-strong">{text("最近调用排序", "Sorted by recent calls")}</h3>
          <div class="border border-border-weak-base rounded-lg overflow-hidden">
            <Show
              when={sorted().length > 0}
              fallback={
                <div class="px-4 py-6 text-14-regular text-text-weak">
                  {text("当前没有可展示的智能体。", "No agents are available.")}
                </div>
              }
            >
              <For each={sorted()}>
                {(item) => (
                  <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex flex-col gap-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-14-medium text-text-strong">{item.name}</span>
                        <span class="text-11-regular text-text-base bg-surface-raised-base px-1.5 py-0.5 rounded-md">
                          {mode(item.mode)}
                        </span>
                        <Show when={item.native}>
                          <span class="text-11-regular text-text-base bg-surface-raised-base px-1.5 py-0.5 rounded-md">
                            {text("内置", "Native")}
                          </span>
                        </Show>
                      </div>
                      <span class="text-12-regular text-text-weak truncate max-w-[480px]">
                        {item.description || item.prompt || text("没有描述", "No description")}
                      </span>
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                      <span class="text-12-regular text-text-weak">{text("7天", "7d")} {item.callCount7d ?? 0}</span>
                      <Button size="small" variant="secondary" onClick={() => open(`/agents/${encodeURIComponent(item.name)}`)}>
                        {text("打开", "Open")}
                      </Button>
                    </div>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>
      </div>
    </div>
  )
}

const Metric: Component<{ label: string; value: number }> = (props) => {
  return (
    <div class="flex flex-col gap-1 rounded-lg border border-border-weak-base bg-surface-raised-base px-4 py-3">
      <span class="text-12-regular text-text-weak">{props.label}</span>
      <span class="text-18-medium text-text-strong">{props.value}</span>
    </div>
  )
}
