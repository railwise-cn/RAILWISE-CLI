import { createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "@railwise/ui/button"
import { Logo } from "@railwise/ui/logo"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { Icon } from "@railwise/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useProviders } from "@/hooks/use-providers"
import { collaborationTarget, recentWorkspaces, recommendedModel } from "@/pages/agents/collaboration"
import { setSessionHandoff } from "@/pages/session/handoff"

export default function Home() {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const dialog = useDialog()
  const navigate = useNavigate()
  const server = useServer()
  const language = useLanguage()
  const providers = useProviders()
  const [directory, setDirectory] = createSignal("")
  const [prompt, setPrompt] = createSignal("")
  const homedir = createMemo(() => sync.data.path.home)
  const recent = createMemo(() => recentWorkspaces(sync.data.project, 5))
  const selectedDirectory = createMemo(() => directory() || recent()[0]?.worktree || "")
  const connectedProviders = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const canStart = createMemo(() => selectedDirectory().trim().length > 0 && prompt().trim().length > 0)
  const modelLabel = createMemo(() => {
    const provider = connectedProviders()[0]
    if (provider) return `${provider.name} / ${recommendedModel}`
    return `默认建议 ${recommendedModel}`
  })
  const starters = [
    "检查当前线路复测资料，列出缺失文件并给出下一步计划。",
    "对外业监测数据做首检，标出异常点和复核建议。",
    "根据资料起草监测方案大纲，并列出需要补充的依据。",
  ]

  const serverDotClass = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "bg-icon-success-base"
    if (healthy === false) return "bg-icon-critical-base"
    return "bg-border-weak-base"
  })

  function compactPath(value: string) {
    const home = homedir()
    if (home && value === home) return "~"
    if (home && value.startsWith(home + "/")) return "~" + value.slice(home.length)
    return value
  }

  function updateDirectory(value: string) {
    setDirectory(value)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      const first = Array.isArray(result) ? result[0] : result
      if (first) setDirectory(first)
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: true,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={true} onSelect={resolve} />,
        () => resolve(null),
      )
    }
  }

  function start() {
    if (!canStart()) return
    const target = collaborationTarget({
      directory: selectedDirectory(),
      agent: "chief_manager",
      prompt: prompt(),
    })
    layout.projects.open(target.directory)
    server.projects.touch(target.directory)
    setSessionHandoff(target.key, { agent: target.agent, prompt: target.prompt })
    navigate(target.href)
  }

  return (
    <main class="min-h-full bg-surface-base px-5 py-5" data-testid="home-workbench">
      <div class="mx-auto flex min-h-[calc(100vh-56px)] max-w-6xl flex-col">
        <header class="flex items-center justify-between gap-3">
          <button type="button" class="flex items-center gap-3 rounded-md px-2 py-1 text-left" onClick={() => navigate("/home")}>
            <Logo class="size-9 opacity-80" />
            <div>
              <div class="text-13-medium text-text-strong">RAILWISE</div>
              <div class="text-12-regular text-text-weak">Desktop</div>
            </div>
          </button>

          <div class="flex items-center gap-2">
            <Button size="small" variant="ghost" onClick={() => navigate("/harness")}>
              执行层
            </Button>
            <Button size="small" variant="ghost" onClick={() => navigate("/marketplace")}>
              能力市场
            </Button>
            <Button size="small" variant="ghost" onClick={() => dialog.show(() => <DialogSelectServer />)}>
              <div
                classList={{
                  "size-2 rounded-full": true,
                  [serverDotClass()]: true,
                }}
              />
              {server.name}
            </Button>
          </div>
        </header>

        <section class="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center py-8">
          <div class="mb-6 text-center">
            <h1 class="text-30-bold text-text-strong">想让 RAILWISE 完成什么？</h1>
          </div>

          <form
            class="rounded-xl border border-border-subtle bg-surface-panel p-3 shadow-sm"
            data-testid="home-chat-composer"
            onSubmit={(event) => {
              event.preventDefault()
              start()
            }}
          >
            <div class="flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3">
              <label class="sr-only" for="home-directory">
                工作区文件夹
              </label>
              <input
                id="home-directory"
                data-testid="home-project-directory"
                class="h-9 min-w-[260px] flex-1 rounded-md border border-border-subtle bg-surface-element px-3 text-13-mono text-text-strong outline-none"
                value={selectedDirectory()}
                onInput={(event) => updateDirectory(event.currentTarget.value)}
                placeholder="/Users/name/CODE/project"
              />
              <Button type="button" size="normal" variant="secondary" icon="folder-add-left" onClick={chooseProject}>
                选择文件夹
              </Button>
            </div>

            <label class="sr-only" for="home-prompt">
              对话
            </label>
            <textarea
              id="home-prompt"
              data-testid="home-task-input"
              class="min-h-[190px] w-full resize-none bg-transparent p-4 text-15-regular text-text-strong outline-none"
              value={prompt()}
              onInput={(event) => setPrompt(event.currentTarget.value)}
              placeholder="例如：检查当前线路复测资料，列出缺失文件，生成下一步执行计划。"
            />

            <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
              <div class="flex flex-wrap gap-2">
                <For each={starters}>
                  {(item) => (
                    <button
                      type="button"
                      class="rounded-full border border-border-subtle px-3 py-1.5 text-12-regular text-text-weak hover:bg-surface-element hover:text-text-strong"
                      onClick={() => setPrompt(item)}
                    >
                      {item.split("，")[0]}
                    </button>
                  )}
                </For>
              </div>
              <Button type="submit" disabled={!canStart()} data-testid="home-start-session">
                开始协作
              </Button>
            </div>
          </form>

          <section class="mt-4 flex flex-wrap items-center justify-center gap-2" data-testid="home-harness-panel">
            <button
              type="button"
              data-testid="home-open-harness"
              class="inline-flex items-center gap-2 rounded-full border border-border-subtle px-3 py-2 text-12-medium text-text-weak hover:bg-surface-panel hover:text-text-strong"
              onClick={() => navigate("/harness")}
            >
              <Icon name="circle-ban-sign" size="small" />
              执行层
            </button>
            <div
              class="inline-flex max-w-[300px] items-center gap-2 rounded-full border border-border-subtle px-3 py-2 text-12-medium text-text-weak"
              data-testid="home-model-summary"
            >
              <Icon name="models" size="small" />
              <span class="truncate">{modelLabel()}</span>
            </div>
            <button
              type="button"
              data-testid="home-open-marketplace"
              class="inline-flex items-center gap-2 rounded-full border border-border-subtle px-3 py-2 text-12-medium text-text-weak hover:bg-surface-panel hover:text-text-strong"
              onClick={() => navigate("/marketplace")}
            >
              <Icon name="providers" size="small" />
              能力市场
            </button>
          </section>

          <Show when={recent().length}>
            <section class="mt-8">
              <div class="mb-2 text-center text-12-medium text-text-weak">{language.t("home.recentProjects")}</div>
              <div class="grid gap-2 md:grid-cols-2">
                <For each={recent()}>
                  {(project) => (
                    <button
                      type="button"
                      class="flex items-center justify-between gap-3 rounded-md border border-border-subtle px-3 py-2 text-left hover:bg-surface-panel"
                      title={project.worktree}
                      onClick={() => updateDirectory(project.worktree)}
                    >
                      <span class="truncate text-12-mono text-text-strong">{compactPath(project.worktree)}</span>
                      <span class="shrink-0 text-11-regular text-text-weak">
                        {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                      </span>
                    </button>
                  )}
                </For>
              </div>
            </section>
          </Show>
        </section>
      </div>
    </main>
  )
}
