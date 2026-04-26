import { Button } from "@railwise/ui/button"
import { showToast } from "@railwise/ui/toast"
import { Component, createMemo, createSignal, For, onMount, Show } from "solid-js"
import type { Command as ServerCommand } from "@railwise/sdk/v2/client"
import { useCommand } from "@/context/command"
import { useDialog } from "@railwise/ui/context/dialog"
import { useGlobalSDK } from "@/context/global-sdk"
import { useLanguage } from "@/context/language"

export const SettingsCommands: Component = () => {
  const language = useLanguage()
  const sdk = useGlobalSDK()
  const command = useCommand()
  const dialog = useDialog()
  const [items, setItems] = createSignal<ServerCommand[]>([])
  const [loading, setLoading] = createSignal(true)

  const text = (zh: string, en: string) => {
    const locale = language.locale()
    if (locale === "zh" || locale === "zht") return zh
    return en
  }

  const builtin = createMemo(() =>
    command.options
      .filter((item) => !item.id.startsWith("suggested."))
      .slice()
      .sort((a, b) => (a.category ?? "").localeCompare(b.category ?? "") || a.title.localeCompare(b.title)),
  )
  const custom = createMemo(() => items().slice().sort((a, b) => a.name.localeCompare(b.name)))
  const slash = createMemo(() => builtin().filter((item) => item.slash).length + custom().length)
  const keybound = createMemo(() => builtin().filter((item) => command.keybind(item.id)).length)

  const load = () => {
    setLoading(true)
    sdk.client.command
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

  const open = () => {
    dialog.close()
    command.show()
  }

  onMount(load)

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-wrap items-start justify-between gap-4 pt-6 pb-8 max-w-[720px]">
          <div class="flex flex-col gap-1 min-w-0">
            <h2 class="text-16-medium text-text-strong">{language.t("settings.commands.title")}</h2>
            <p class="text-14-regular text-text-weak">
              {text("查看内置命令、快捷键和当前工程的 slash 命令。", "Review commands, shortcuts, and project slash commands.")}
            </p>
          </div>
          <div class="flex gap-2">
            <Button size="large" variant="secondary" icon="arrow-up" disabled={loading()} onClick={load}>
              {loading() ? text("刷新中", "Refreshing") : text("刷新", "Refresh")}
            </Button>
            <Button size="large" variant="primary" icon="console" onClick={open}>
              {text("命令面板", "Command palette")}
            </Button>
          </div>
        </div>
      </div>

      <div class="flex flex-col gap-6 max-w-[720px]">
        <div class="grid grid-cols-4 gap-3">
          <Metric label={text("内置命令", "Built-in")} value={builtin().length} />
          <Metric label={text("工程命令", "Project")} value={custom().length} />
          <Metric label="Slash" value={slash()} />
          <Metric label={text("快捷键", "Keybinds")} value={keybound()} />
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-14-medium text-text-strong">{text("工程 Slash 命令", "Project slash commands")}</h3>
          <div class="border border-border-weak-base rounded-lg overflow-hidden">
            <Show
              when={custom().length > 0}
              fallback={
                <div class="px-4 py-6 text-14-regular text-text-weak">
                  {text("当前工程没有自定义 slash 命令。", "No custom slash commands are available.")}
                </div>
              }
            >
              <For each={custom()}>
                {(item) => (
                  <div class="flex flex-wrap items-start justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
                    <div class="flex flex-col gap-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="text-14-medium text-text-strong">/{item.name}</span>
                        <span class="text-11-regular text-text-base bg-surface-raised-base px-1.5 py-0.5 rounded-md">
                          {item.source ?? "command"}
                        </span>
                      </div>
                      <span class="text-12-regular text-text-weak truncate max-w-[520px]">
                        {item.description || item.template}
                      </span>
                    </div>
                    <span class="text-12-regular text-text-weak shrink-0">{item.agent ?? item.model ?? ""}</span>
                  </div>
                )}
              </For>
            </Show>
          </div>
        </div>

        <div class="flex flex-col gap-2">
          <h3 class="text-14-medium text-text-strong">{text("应用命令", "Application commands")}</h3>
          <div class="border border-border-weak-base rounded-lg overflow-hidden">
            <For each={builtin().slice(0, 24)}>
              {(item) => (
                <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3 border-b border-border-weak-base last:border-none">
                  <div class="flex flex-col gap-1 min-w-0">
                    <span class="text-14-medium text-text-strong truncate">{item.title}</span>
                    <span class="text-12-regular text-text-weak truncate max-w-[520px]">
                      {item.description || item.category || item.id}
                    </span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <Show when={item.slash}>
                      <span class="text-12-regular text-text-base bg-surface-raised-base px-2 py-1 rounded-md">
                        /{item.slash}
                      </span>
                    </Show>
                    <Show when={command.keybind(item.id)}>
                      {(keybind) => (
                        <span class="text-12-regular text-text-base bg-surface-raised-base px-2 py-1 rounded-md">
                          {keybind()}
                        </span>
                      )}
                    </Show>
                  </div>
                </div>
              )}
            </For>
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
