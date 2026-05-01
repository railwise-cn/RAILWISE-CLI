import { Button } from "@railwise/ui/button"
import { Switch } from "@railwise/ui/switch"
import { showToast } from "@railwise/ui/toast"
import { Component, createMemo, createSignal, For, onMount, Show } from "solid-js"
import type { McpStatus } from "@railwise/sdk/v2/client"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"

export const SettingsMcp: Component = () => {
  const language = useLanguage()
  const sdk = useGlobalSDK()
  const [items, setItems] = createSignal<Record<string, McpStatus>>({})
  const [busy, setBusy] = createSignal<string | undefined>()
  const [loading, setLoading] = createSignal(true)

  const text = (zh: string, en: string) => {
    const locale = language.locale()
    if (locale === "zh" || locale === "zht") return zh
    return en
  }

  const names = createMemo(() => Object.keys(items()).sort((a, b) => a.localeCompare(b)))
  const connected = createMemo(() => names().filter((name) => items()[name]?.status === "connected").length)
  const issues = createMemo(
    () =>
      names().filter((name) => {
        const status = items()[name]?.status
        return status !== "connected" && status !== "disabled"
      }).length,
  )

  const label = (status: McpStatus["status"] | undefined) => {
    if (status === "connected") return text("已连接", "Connected")
    if (status === "disabled") return text("已禁用", "Disabled")
    if (status === "needs_auth") return text("需要授权", "Needs auth")
    if (status === "needs_client_registration") return text("需要客户端注册", "Needs registration")
    if (status === "failed") return text("连接失败", "Failed")
    return text("未知", "Unknown")
  }

  const load = () => {
    setLoading(true)
    sdk.client.mcp
      .status()
      .then((result) => setItems(result.data ?? {}))
      .catch((err: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        }),
      )
      .finally(() => setLoading(false))
  }

  const toggle = (name: string) => {
    if (busy()) return
    setBusy(name)
    const current = items()[name]
    const action =
      current?.status === "connected" ? sdk.client.mcp.disconnect({ name }) : sdk.client.mcp.connect({ name })
    action
      .then(() => sdk.client.mcp.status())
      .then((result) => setItems(result.data ?? {}))
      .catch((err: unknown) =>
        showToast({
          variant: "error",
          title: language.t("common.requestFailed"),
          description: err instanceof Error ? err.message : String(err),
        }),
      )
      .finally(() => setBusy(undefined))
  }

  onMount(load)

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-wrap items-start justify-between gap-4 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1 min-w-0">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.mcp.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {text("查看并切换当前工程可用的 MCP 服务连接。", "Review and toggle MCP server connections.")}
            </p>
          </div>
          <Button size="large" variant="secondary" icon="arrow-up" disabled={loading()} onClick={load}>
            {loading() ? text("刷新中", "Refreshing") : text("刷新", "Refresh")}
          </Button>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <div class="grid grid-cols-3 gap-3">
          <Metric label={text("服务总数", "Servers")} value={names().length} />
          <Metric label={text("已连接", "Connected")} value={connected()} />
          <Metric label={text("需处理", "Needs attention")} value={issues()} />
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-14-medium text-text-strong">{text("服务列表", "Servers")}</h3>
          <div class="border border-border-weak-base rounded-lg overflow-hidden">
            <Show
              when={names().length > 0}
              fallback={
                <div class="px-4 py-6 text-14-regular text-text-weak">
                  {text("当前没有配置 MCP 服务。", "No MCP servers are configured.")}
                </div>
              }
            >
              <For each={names()}>
                {(name) => {
                  const status = () => items()[name]
                  return (
                    <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
                      <div class="flex items-center gap-3 min-w-0">
                        <div
                          classList={{
                            "size-2 rounded-full shrink-0": true,
                            "bg-icon-success-base": status()?.status === "connected",
                            "bg-icon-critical-base": status()?.status === "failed",
                            "bg-icon-warning-base":
                              status()?.status === "needs_auth" || status()?.status === "needs_client_registration",
                            "bg-border-weak-base": status()?.status === "disabled",
                          }}
                        />
                        <div class="flex flex-col min-w-0">
                          <span class="text-14-medium text-text-strong truncate">{name}</span>
                          <span class="text-12-regular text-text-weak truncate">
                            {label(status()?.status)}
                            <Show when={status()?.status === "failed" && "error" in status()}>
                              {` · ${(status() as { error?: string }).error ?? ""}`}
                            </Show>
                          </span>
                        </div>
                      </div>
                      <Switch
                        checked={status()?.status === "connected"}
                        disabled={busy() === name}
                        onChange={() => toggle(name)}
                      />
                    </div>
                  )
                }}
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
