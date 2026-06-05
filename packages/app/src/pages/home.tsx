import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { Button } from "@railwise/ui/button"
import { Mark } from "@railwise/ui/logo"
import { useLayout } from "@/context/layout"
import { useNavigate } from "@solidjs/router"
import { Icon } from "@railwise/ui/icon"
import { usePlatform } from "@/context/platform"
import { DateTime } from "luxon"
import { base64Encode } from "@railwise/util/encode"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectServer } from "@/components/dialog-select-server"
import { useServer } from "@/context/server"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useProviders } from "@/hooks/use-providers"
import { collaborationTarget, recentWorkspaces, recommendedModel } from "@/pages/agents/collaboration"
import { setSessionHandoff } from "@/pages/session/handoff"
import { sortedRootSessions } from "@/pages/layout/helpers"

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
  const projectStore = createMemo(() => {
    const target = selectedDirectory()
    if (!target) return
    return sync.child(target, { bootstrap: false })[0]
  })
  const projectSessions = createMemo(() => {
    const store = projectStore()
    if (!store) return []
    return sortedRootSessions(store, Date.now()).slice(0, 4)
  })
  const runningSessions = createMemo(() =>
    Object.values(projectStore()?.session_status ?? {}).filter((status) => status.type === "busy" || status.type === "retry").length,
  )
  const pendingActions = createMemo(
    () =>
      Object.values(projectStore()?.permission ?? {}).flat().length +
      Object.values(projectStore()?.question ?? {}).flat().length,
  )
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
    return "选择项目后开始会话"
  })
  const runningLabel = createMemo(() => {
    const count = runningSessions()
    if (count > 0) return `${count} 个任务运行中`
    return "空闲"
  })
  const actionLabel = createMemo(() => {
    const count = pendingActions()
    if (count > 0) return `${count} 项待确认`
    return "无需确认"
  })
  const modelStateLabel = createMemo(() => (connectedProviders().length > 0 ? "模型已接入" : "待接入模型"))

  createEffect(() => {
    const target = selectedDirectory()
    if (!target) return
    layout.projects.open(target)
    server.projects.touch(target)
  })

  function projectName(value: string) {
    const clean = value.trim().replaceAll("\\", "/").replace(/\/+$/, "")
    const parts = clean.split("/").filter(Boolean)
    return parts.at(-1) ?? "选择项目"
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

  function openSession(id: string, target = selectedDirectory()) {
    if (!target) return
    navigate(`/${base64Encode(target)}/session/${id}`)
  }

  function newSession(target = selectedDirectory()) {
    if (!target) {
      void chooseProject()
      return
    }
    navigate(`/${base64Encode(target)}/session`)
  }

  return (
    <main class="min-h-full bg-surface-base" data-testid="home-workbench">
      <div class="mx-auto flex min-h-screen max-w-6xl">
        <section class="flex min-w-0 flex-1 flex-col px-5 py-5 lg:px-8">
          <header class="flex items-center justify-between gap-3">
            <button type="button" class="flex items-center gap-3 rounded-md px-2 py-1 text-left lg:hidden" onClick={() => navigate("/home")}>
              <Mark class="size-8 opacity-85" />
              <div>
                <div class="text-13-medium text-text-strong">RAILWISE</div>
                <div class="text-12-regular text-text-weak">Desktop</div>
              </div>
            </button>
            <div class="ml-auto hidden items-center gap-2 text-12-regular text-text-weak lg:flex">
              <span
                classList={{
                  "size-2 rounded-full": true,
                  [serverDotClass()]: true,
                }}
              />
              {serverLabel()}
            </div>
          </header>

          <section class="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center py-8">
            <div class="mb-5 text-center">
              <h1 class="text-30-bold text-text-strong">RAILWISE</h1>
              <p class="mt-3 text-18-medium text-text-strong" data-testid="home-main-prompt">
                想让 RAILWISE 完成什么？
              </p>
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
                <div class="flex min-w-0 flex-1 items-center gap-3 rounded-lg bg-surface-element px-3 py-2" data-testid="home-project-directory">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-md border border-border-weak-base text-text-weak">
                    <Icon name="folder" size="small" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-13-medium text-text-strong">{selectedName()}</div>
                    <div class="truncate text-11-regular text-text-weak">{selectedMeta()}</div>
                  </div>
                </div>
                <Button type="button" size="normal" variant="secondary" icon="folder-add-left" onClick={chooseProject}>
                  选择项目
                </Button>
              </div>

              <label class="sr-only" for="home-prompt">
                想让 RAILWISE 完成什么？
              </label>
              <textarea
                id="home-prompt"
                data-testid="home-task-input"
                class="min-h-[210px] w-full resize-none bg-transparent p-4 text-15-regular text-text-strong outline-none"
                value={prompt()}
                onInput={(event) => setPrompt(event.currentTarget.value)}
                placeholder="例如：检查复测资料并生成下一步计划。"
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

            <section
              class="mt-4 rounded-lg border border-border-weak-base bg-surface-panel/70 px-4 py-3"
              data-testid="home-harness-panel"
            >
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-12-regular text-text-weak">
                  <div class="inline-flex items-center gap-2" data-testid="home-open-harness">
                    <span
                      classList={{
                        "size-2 rounded-full": true,
                        [serverDotClass()]: true,
                      }}
                    />
                    连接：{serverLabel()}
                  </div>
                  <div class="inline-flex min-w-0 items-center gap-2" data-testid="home-model-summary">
                    <Icon name="models" size="small" />
                    <span class="truncate">模型：{modelLabel()}</span>
                  </div>
                </div>
                <button
                  type="button"
                  data-testid="home-open-marketplace"
                  class="inline-flex items-center gap-1.5 text-12-medium text-text-weak hover:text-text-strong"
                  onClick={() => navigate("/marketplace")}
                >
                  <Icon name="providers" size="small" />
                  能力市场
                </button>
              </div>
            </section>
          </section>
        </section>

        <aside class="hidden w-80 shrink-0 flex-col border-l border-border-weak-base bg-surface-base px-4 py-5 xl:flex" data-testid="home-project-rail">
          <section class="rounded-lg border border-border-weak-base bg-surface-panel p-3" data-testid="home-project-summary">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-12-medium text-text-weak">项目</div>
              <button type="button" class="text-12-medium text-text-weak hover:text-text-strong" onClick={chooseProject}>
                切换
              </button>
            </div>
            <div class="flex items-center gap-3">
              <span class="flex size-9 shrink-0 items-center justify-center rounded-md border border-border-weak-base text-text-weak">
                <Icon name="folder" size="small" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="truncate text-14-medium text-text-strong">{selectedName()}</div>
                <div class="mt-1 truncate text-12-regular text-text-weak">{selectedMeta()}</div>
              </div>
            </div>
          </section>

          <section class="mt-4 rounded-lg border border-border-weak-base bg-surface-panel p-3" data-testid="home-session-rail">
            <div class="mb-3 flex items-center justify-between gap-3">
              <div class="text-12-medium text-text-weak">会话</div>
              <button type="button" class="inline-flex items-center gap-1 text-12-medium text-text-weak hover:text-text-strong" onClick={() => newSession()}>
                <Icon name="plus-small" size="small" />
                新建
              </button>
            </div>
            <div class="space-y-1">
              <Show
                when={projectSessions().length > 0}
                fallback={
                  <div class="rounded-md border border-dashed border-border-weak-base px-3 py-4">
                    <div class="text-13-medium text-text-strong">还没有会话</div>
                    <div class="mt-1 text-12-regular text-text-weak">输入任务后会自动创建。</div>
                  </div>
                }
              >
                <For each={projectSessions()}>
                  {(session) => (
                    <button
                      type="button"
                      class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-surface-element"
                      onClick={() => openSession(session.id, session.directory)}
                    >
                      <Icon name="new-session" size="small" class="shrink-0 text-text-weak" />
                      <span class="min-w-0 flex-1">
                        <span class="block truncate text-13-medium text-text-strong">{session.title}</span>
                        <span class="block truncate text-12-regular text-text-weak">
                          {DateTime.fromMillis(session.time.updated ?? session.time.created).toRelative() ?? "最近更新"}
                        </span>
                      </span>
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </section>

          <section class="mt-4 rounded-lg border border-border-weak-base bg-surface-panel p-3" data-testid="home-runtime-rail">
            <div class="mb-3 flex items-center justify-between">
              <div class="text-12-medium text-text-weak">执行</div>
              <button type="button" class="text-12-medium text-text-weak hover:text-text-strong" onClick={() => navigate("/harness")}>
                查看
              </button>
            </div>
            <div class="space-y-3">
              <div class="flex items-start gap-2">
                <Icon name="server" size="small" class="mt-0.5 shrink-0 text-text-weak" />
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 text-13-medium text-text-strong">
                    服务
                    <span
                      classList={{
                        "size-2 rounded-full": true,
                        [serverDotClass()]: true,
                      }}
                    />
                  </div>
                  <div class="mt-1 text-12-regular text-text-weak">{serverLabel()}</div>
                </div>
              </div>
              <div class="flex items-start gap-2">
                <Icon name="checklist" size="small" class="mt-0.5 shrink-0 text-text-weak" />
                <div class="min-w-0 flex-1">
                  <div class="text-13-medium text-text-strong">任务</div>
                  <div class="mt-1 truncate text-12-regular text-text-weak">{runningLabel()} · {actionLabel()}</div>
                </div>
              </div>
              <div class="flex items-start gap-2">
                <Icon name="models" size="small" class="mt-0.5 shrink-0 text-text-weak" />
                <div class="min-w-0 flex-1">
                  <div class="text-13-medium text-text-strong">模型</div>
                  <div class="mt-1 truncate text-12-regular text-text-weak">{modelStateLabel()}</div>
                </div>
              </div>
              <button
                type="button"
                class="flex w-full items-center justify-between rounded-md border border-border-weak-base px-3 py-2 text-left hover:bg-surface-element"
                onClick={() => navigate("/marketplace")}
              >
                <span class="inline-flex min-w-0 items-center gap-2 text-13-medium text-text-strong">
                  <Icon name="providers" size="small" class="shrink-0 text-text-weak" />
                  能力市场
                </span>
                <span class="text-12-regular text-text-weak">打开</span>
              </button>
            </div>
          </section>
        </aside>
      </div>
    </main>
  )
}
