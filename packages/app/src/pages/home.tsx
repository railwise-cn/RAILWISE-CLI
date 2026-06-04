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
  const recent = createMemo(() => recentWorkspaces(sync.data.project, 5))
  const selectedDirectory = createMemo(() => directory() || recent()[0]?.worktree || "")
  const selectedProject = createMemo(() => recent().find((project) => project.worktree === selectedDirectory()))
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
  const serverLabel = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "已连接"
    if (healthy === false) return "待连接"
    return "检查中"
  })
  const selectedName = createMemo(() => projectName(selectedDirectory()))
  const selectedMeta = createMemo(() => {
    const project = selectedProject()
    if (project) return DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative() ?? "最近使用"
    if (selectedDirectory()) return "本地工作区"
    return "先选择项目"
  })

  function projectName(value: string) {
    const clean = value.trim().replaceAll("\\", "/").replace(/\/+$/, "")
    const parts = clean.split("/").filter(Boolean)
    return parts.at(-1) ?? "未选择项目"
  }

  function selectDirectory(value: string) {
    setDirectory(value)
  }

  async function chooseProject() {
    function resolve(result: string | string[] | null) {
      const first = Array.isArray(result) ? result[0] : result
      if (first) selectDirectory(first)
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog?.({
        title: language.t("command.project.open"),
        multiple: false,
      })
      resolve(result)
    } else {
      dialog.show(
        () => <DialogSelectDirectory multiple={false} onSelect={resolve} />,
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
    <main class="min-h-full bg-surface-base" data-testid="home-workbench">
      <div class="mx-auto flex min-h-screen max-w-7xl">
        <aside class="hidden w-64 shrink-0 flex-col border-r border-border-weak-base px-4 py-5 lg:flex">
          <button type="button" class="mb-7 flex items-center gap-3 rounded-md px-2 py-1 text-left" onClick={() => navigate("/home")}>
            <Logo class="size-8 opacity-85" />
            <div>
              <div class="text-13-medium text-text-strong">RAILWISE</div>
              <div class="text-12-regular text-text-weak">Desktop</div>
            </div>
          </button>

          <div class="mb-3 flex items-center justify-between">
            <div class="text-12-medium text-text-weak">{language.t("home.recentProjects")}</div>
            <button
              type="button"
              class="inline-flex size-7 items-center justify-center rounded-md border border-border-weak-base text-text-weak hover:bg-surface-panel hover:text-text-strong"
              onClick={chooseProject}
              aria-label="添加项目"
            >
              <Icon name="plus-small" size="small" />
            </button>
          </div>

          <nav class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" aria-label="项目">
            <Show when={recent().length} fallback={<div class="rounded-lg border border-dashed border-border-weak-base p-3 text-12-regular text-text-weak">选择文件夹后会出现在这里。</div>}>
              <For each={recent()}>
                {(project) => {
                  const active = createMemo(() => project.worktree === selectedDirectory())
                  return (
                    <button
                      type="button"
                      class="group flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-surface-panel"
                      classList={{
                        "bg-surface-panel": active(),
                      }}
                      onClick={() => selectDirectory(project.worktree)}
                    >
                      <span class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-weak-base text-text-weak group-hover:text-text-strong">
                        <Icon name="folder" size="small" />
                      </span>
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-13-medium text-text-strong">{projectName(project.worktree)}</span>
                        <span class="block truncate text-11-regular text-text-weak">
                          {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                        </span>
                      </span>
                    </button>
                  )
                }}
              </For>
            </Show>
          </nav>

          <div class="mt-4 rounded-lg border border-border-weak-base bg-surface-panel p-3">
            <div class="mb-2 flex items-center gap-2 text-12-medium text-text-strong">
              <span
                classList={{
                  "size-2 rounded-full": true,
                  [serverDotClass()]: true,
                }}
              />
              {serverLabel()}
            </div>
            <div class="text-11-regular text-text-weak">{server.name}</div>
          </div>
        </aside>

        <section class="flex min-w-0 flex-1 flex-col px-5 py-5 lg:px-8">
          <header class="flex items-center justify-between gap-3">
            <button type="button" class="flex items-center gap-3 rounded-md px-2 py-1 text-left lg:hidden" onClick={() => navigate("/home")}>
              <Logo class="size-8 opacity-85" />
              <div>
                <div class="text-13-medium text-text-strong">RAILWISE</div>
                <div class="text-12-regular text-text-weak">Desktop</div>
              </div>
            </button>
            <div class="ml-auto flex items-center gap-2">
              <Button size="small" variant="ghost" icon="server" onClick={() => navigate("/harness")}>
                执行层
              </Button>
              <Button size="small" variant="ghost" icon="providers" onClick={() => navigate("/marketplace")}>
                能力市场
              </Button>
            </div>
          </header>

          <section class="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8">
            <div class="mb-5 text-center">
              <h1 class="text-30-bold text-text-strong">想让 RAILWISE 完成什么？</h1>
            </div>

            <form
              class="rounded-xl border border-border-weak-base bg-surface-panel p-3 shadow-sm"
              data-testid="home-chat-composer"
              onSubmit={(event) => {
                event.preventDefault()
                start()
              }}
            >
              <div class="flex flex-wrap items-center gap-3 border-b border-border-weak-base pb-3">
                <div class="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-surface-element px-3 py-2">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-weak-base text-text-weak">
                    <Icon name="folder" size="small" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-13-medium text-text-strong">{selectedName()}</div>
                    <div class="truncate text-11-regular text-text-weak">{selectedMeta()}</div>
                  </div>
                </div>
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
                class="min-h-[210px] w-full resize-none bg-transparent p-4 text-15-regular text-text-strong outline-none"
                value={prompt()}
                onInput={(event) => setPrompt(event.currentTarget.value)}
                placeholder="例如：检查当前线路复测资料，列出缺失文件，生成下一步执行计划。"
              />

              <div class="flex flex-wrap items-center justify-between gap-2 border-t border-border-weak-base pt-3">
                <div class="flex flex-wrap gap-2">
                  <For each={starters}>
                    {(item) => (
                      <button
                        type="button"
                        class="rounded-full border border-border-weak-base px-3 py-1.5 text-12-regular text-text-weak hover:bg-surface-element hover:text-text-strong"
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
                class="inline-flex items-center gap-2 rounded-full border border-border-weak-base px-3 py-2 text-12-medium text-text-weak hover:bg-surface-panel hover:text-text-strong"
                onClick={() => navigate("/harness")}
              >
                <Icon name="server" size="small" />
                执行层
              </button>
              <div
                class="inline-flex max-w-[300px] items-center gap-2 rounded-full border border-border-weak-base px-3 py-2 text-12-medium text-text-weak"
                data-testid="home-model-summary"
              >
                <Icon name="models" size="small" />
                <span class="truncate">{modelLabel()}</span>
              </div>
              <button
                type="button"
                data-testid="home-open-marketplace"
                class="inline-flex items-center gap-2 rounded-full border border-border-weak-base px-3 py-2 text-12-medium text-text-weak hover:bg-surface-panel hover:text-text-strong"
                onClick={() => navigate("/marketplace")}
              >
                <Icon name="providers" size="small" />
                能力市场
              </button>
            </section>
          </section>
        </section>

        <aside class="hidden w-72 shrink-0 flex-col border-l border-border-weak-base px-4 py-5 xl:flex">
          <div class="mb-5">
            <div class="text-12-medium text-text-weak">当前项目</div>
            <div class="mt-2 rounded-lg border border-border-weak-base bg-surface-panel p-3">
              <div class="truncate text-14-medium text-text-strong">{selectedName()}</div>
              <div class="mt-1 text-12-regular text-text-weak">{selectedMeta()}</div>
            </div>
          </div>

          <div class="space-y-2" data-testid="home-harness-inspector">
            <button
              type="button"
              class="w-full rounded-lg border border-border-weak-base bg-surface-panel p-3 text-left hover:bg-surface-element"
              onClick={() => navigate("/harness")}
            >
              <div class="flex items-center gap-2 text-13-medium text-text-strong">
                <Icon name="server" size="small" />
                执行层
              </div>
              <div class="mt-2 flex items-center gap-2 text-12-regular text-text-weak">
                <span
                  classList={{
                    "size-2 rounded-full": true,
                    [serverDotClass()]: true,
                  }}
                />
                {serverLabel()}
              </div>
            </button>
            <button
              type="button"
              class="w-full rounded-lg border border-border-weak-base bg-surface-panel p-3 text-left hover:bg-surface-element"
              onClick={() => navigate("/marketplace")}
            >
              <div class="flex items-center gap-2 text-13-medium text-text-strong">
                <Icon name="models" size="small" />
                模型
              </div>
              <div class="mt-2 truncate text-12-regular text-text-weak">{modelLabel()}</div>
            </button>
            <button
              type="button"
              class="w-full rounded-lg border border-border-weak-base bg-surface-panel p-3 text-left hover:bg-surface-element"
              onClick={() => navigate("/marketplace")}
            >
              <div class="flex items-center gap-2 text-13-medium text-text-strong">
                <Icon name="providers" size="small" />
                能力市场
              </div>
              <div class="mt-2 text-12-regular text-text-weak">智能体、工具、流程统一安装。</div>
            </button>
          </div>
        </aside>
      </div>
    </main>
  )
}
