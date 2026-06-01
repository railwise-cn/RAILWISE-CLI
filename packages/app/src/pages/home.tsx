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
    <main class="min-h-full px-6 py-5" data-testid="home-workbench">
      <div class="grid h-full min-h-[calc(100vh-56px)] grid-cols-[260px_minmax(0,1fr)] gap-4">
        <aside class="flex flex-col rounded-lg border border-border-subtle bg-surface-panel p-4">
          <div class="flex items-center gap-3">
            <Logo class="size-9 opacity-80" />
            <div>
              <div class="text-13-medium text-text-strong">RAILWISE</div>
              <div class="text-12-regular text-text-weak">工程测绘智能体工作台</div>
            </div>
          </div>

          <Button
            size="normal"
            variant="ghost"
            class="mt-4 justify-start text-13-regular text-text-weak"
            onClick={() => dialog.show(() => <DialogSelectServer />)}
          >
            <div
              classList={{
                "size-2 rounded-full": true,
                [serverDotClass()]: true,
              }}
            />
            {server.name}
          </Button>

          <div class="mt-6 flex flex-col gap-2">
            <div class="text-12-medium text-text-weak">工作区</div>
            <Button icon="folder-add-left" size="normal" class="justify-start" onClick={chooseProject}>
              {language.t("command.project.open")}
            </Button>
            <Show
              when={selectedDirectory()}
              fallback={<div class="rounded-md bg-surface-element p-3 text-12-regular text-text-weak">工作区未选择</div>}
            >
              {(path) => (
                <button
                  type="button"
                  class="rounded-md bg-surface-element p-3 text-left text-12-mono text-text-strong"
                  title={path()}
                  onClick={() => updateDirectory(path())}
                >
                  {compactPath(path())}
                </button>
              )}
            </Show>
          </div>

          <Show when={recent().length}>
            <div class="mt-6 flex flex-col gap-2">
              <div class="text-12-medium text-text-weak">{language.t("home.recentProjects")}</div>
              <For each={recent()}>
                {(project) => (
                  <button
                    type="button"
                    class="rounded-md px-2 py-2 text-left hover:bg-surface-element"
                    title={project.worktree}
                    onClick={() => updateDirectory(project.worktree)}
                  >
                    <div class="truncate text-12-mono text-text-strong">{compactPath(project.worktree)}</div>
                    <div class="text-11-regular text-text-weak">
                      {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>

          <div class="mt-auto flex flex-col gap-2 pt-6">
            <Button variant="ghost" size="normal" class="justify-start" onClick={() => navigate("/marketplace")}>
              能力市场
            </Button>
          </div>
        </aside>

        <section class="flex min-w-0 flex-col rounded-lg border border-border-subtle bg-surface-panel">
          <div class="border-b border-border-subtle px-6 py-5">
            <div class="text-12-medium uppercase text-text-weak">本地 AI 工作台</div>
            <h1 class="mt-2 text-28-bold text-text-strong">想让 RAILWISE 完成什么？</h1>
          </div>

          <form
            class="flex flex-1 flex-col p-6"
            data-testid="home-chat-composer"
            onSubmit={(event) => {
              event.preventDefault()
              start()
            }}
          >
            <label class="text-13-medium text-text-strong" for="home-directory">
              工作区文件夹
            </label>
            <div class="mt-2 flex gap-2">
              <input
                id="home-directory"
                data-testid="home-project-directory"
                class="h-10 min-w-0 flex-1 rounded-md border border-border-subtle bg-surface-element px-3 text-13-mono text-text-strong"
                value={selectedDirectory()}
                onInput={(event) => updateDirectory(event.currentTarget.value)}
                placeholder="/Users/name/CODE/project"
              />
              <Button type="button" variant="secondary" onClick={chooseProject}>
                选择文件夹
              </Button>
            </div>

            <label class="mt-5 text-13-medium text-text-strong" for="home-prompt">
              对话
            </label>
            <textarea
              id="home-prompt"
              data-testid="home-task-input"
              class="mt-2 min-h-42 resize-y rounded-md border border-border-subtle bg-surface-element p-4 text-14-regular text-text-strong outline-none"
              value={prompt()}
              onInput={(event) => setPrompt(event.currentTarget.value)}
              placeholder="例如：检查当前线路复测资料，列出缺失文件，生成下一步执行计划。"
            />

            <div class="mt-4 flex items-center justify-end">
              <Button type="submit" disabled={!canStart()} data-testid="home-start-session">
                开始协作
              </Button>
            </div>

            <section class="mt-4 grid gap-2 md:grid-cols-3" data-testid="home-harness-panel">
              <button
                type="button"
                data-testid="home-open-harness"
                class="rounded-md border border-border-subtle bg-surface-element p-3 text-left hover:bg-surface-raised-base-hover"
                onClick={() => navigate("/harness")}
              >
                <div class="flex items-center gap-2 text-12-medium text-text-strong">
                  <Icon name="circle-ban-sign" size="small" />
                  本地安全模式
                </div>
                <div class="mt-1 text-12-regular text-text-weak">高风险动作先确认</div>
              </button>
              <div class="rounded-md border border-border-subtle bg-surface-element p-3" data-testid="home-model-summary">
                <div class="text-12-medium text-text-strong">模型</div>
                <div class="mt-1 truncate text-12-regular text-text-weak">{modelLabel()}</div>
              </div>
              <button
                type="button"
                data-testid="home-open-marketplace"
                class="rounded-md border border-border-subtle bg-surface-element p-3 text-left hover:bg-surface-raised-base-hover"
                onClick={() => navigate("/marketplace")}
              >
                <div class="text-12-medium text-text-strong">能力市场</div>
                <div class="mt-1 text-12-regular text-text-weak">智能体 / 工具 / Skills</div>
              </button>
            </section>
          </form>
        </section>
      </div>
    </main>
  )
}
