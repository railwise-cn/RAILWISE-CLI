import "./workbench.css"
import { A, useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { collaborationTarget } from "@/pages/agents/collaboration"
import { setSessionHandoff } from "@/pages/session/handoff"
import {
  compactPath,
  defaultAgent,
  defaultModel,
  emptyPrompt,
  primaryActionLabel,
  promptExamples,
  recentWorkspaces,
} from "./workbench-state"

const agents = [
  { value: "chief_manager", label: "睿威主控", note: "拆解任务、调度专业能力" },
  { value: "cpiii_specialist", label: "线路复测专家", note: "CPⅢ、控制网与复测资料" },
  { value: "adjustment_computer", label: "平差计算专家", note: "观测数据、平差与成果检查" },
  { value: "norm_librarian", label: "规范资料员", note: "规范条文、交付清单与引用" },
] as const

const events = [
  { title: "会话准备", detail: "选择资料目录后建立本地上下文", tone: "ready" },
  { title: "能力调度", detail: "按任务加载智能体、Skills 与工具", tone: "idle" },
  { title: "权限门禁", detail: "文件写入、命令执行前会明确请求确认", tone: "safe" },
] as const

export default function WorkbenchPage() {
  const dialog = useDialog()
  const layout = useLayout()
  const navigate = useNavigate()
  const platform = usePlatform()
  const server = useServer()
  const sync = useGlobalSync()
  const [directory, setDirectory] = createSignal("")
  const [manual, setManual] = createSignal(false)
  const [agent, setAgent] = createSignal(defaultAgent)
  const [draft, setDraft] = createSignal("")

  const recent = createMemo(() => recentWorkspaces(sync.data.project, 5))
  const hasWorkspace = createMemo(() => directory().trim().length > 0)
  const hasPrompt = createMemo(() => draft().trim().length > 0)
  const workspace = createMemo(() => compactPath({ value: directory(), home: sync.data.path.home }))
  const selected = createMemo(() => agents.find((item) => item.value === agent()) ?? agents[0])
  const canStart = createMemo(() => hasWorkspace() && hasPrompt())

  const updateDirectory = (value: string) => {
    setManual(true)
    setDirectory(value)
  }

  const chooseDirectory = async () => {
    const resolve = (value: string | string[] | null) => {
      const next = Array.isArray(value) ? value[0] : value
      if (next) updateDirectory(next)
    }

    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      resolve(
        await platform.openDirectoryPickerDialog({
          title: "选择资料目录",
          multiple: false,
        }),
      )
      return
    }
    dialog.show(
      () => <DialogSelectDirectory title="选择资料目录" onSelect={resolve} />,
      () => resolve(null),
    )
  }

  const startSession = () => {
    if (!canStart()) return
    const target = collaborationTarget({
      directory: directory(),
      agent: agent(),
      prompt: draft(),
    })
    layout.projects.open(target.directory)
    server.projects.touch(target.directory)
    setSessionHandoff(target.key, { prompt: target.prompt })
    navigate(target.href)
  }

  const primary = async () => {
    if (!hasWorkspace()) {
      await chooseDirectory()
      return
    }
    startSession()
  }

  createEffect(() => {
    if (manual() || directory()) return
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (current) setDirectory(current)
  })

  return (
    <main class="workbench" data-testid="workbench-page">
      <aside class="workbench-sidebar" aria-label="工作区导航">
        <div class="workbench-brand">
          <span class="workbench-brand__mark">R</span>
          <div>
            <strong>RAILWISE</strong>
            <span>工程 AI 工作台</span>
          </div>
        </div>

        <button class="workbench-sidebar__primary" type="button" onClick={chooseDirectory}>
          选择资料目录
        </button>

        <section class="workbench-sidebar__section">
          <h2>当前工作区</h2>
          <Show when={hasWorkspace()} fallback={<p>{emptyPrompt({ hasWorkspace: false })}</p>}>
            <button class="workbench-workspace" type="button" onClick={() => updateDirectory(directory())}>
              <span>{workspace()}</span>
            </button>
          </Show>
        </section>

        <section class="workbench-sidebar__section">
          <h2>最近工作区</h2>
          <Show when={recent().length > 0} fallback={<p>还没有打开过资料目录。</p>}>
            <ul class="workbench-recent">
              <For each={recent()}>
                {(project) => (
                  <li>
                    <button type="button" onClick={() => updateDirectory(project.worktree)}>
                      {compactPath({ value: project.worktree, home: sync.data.path.home })}
                    </button>
                  </li>
                )}
              </For>
            </ul>
          </Show>
        </section>

        <nav class="workbench-nav" aria-label="扩展入口">
          <A href="/marketplace">能力市场</A>
          <A href="/harness">Harness</A>
          <A href="/agents">高级智能体设置</A>
        </nav>
      </aside>

      <section class="workbench-chat" aria-label="任务对话">
        <header class="workbench-chat__header">
          <div>
            <span>本地 Harness</span>
            <h1>告诉 RAILWISE 你想完成什么</h1>
          </div>
          <div class="workbench-model">
            <span>默认模型</span>
            <strong>{defaultModel}</strong>
          </div>
        </header>

        <form
          class="workbench-composer"
          onSubmit={(event) => {
            event.preventDefault()
            startSession()
          }}
        >
          <div class="workbench-composer__top">
            <label>
              协作智能体
              <select value={agent()} onChange={(event) => setAgent(event.currentTarget.value)}>
                <For each={agents}>{(item) => <option value={item.value}>{item.label}</option>}</For>
              </select>
            </label>
            <div class="workbench-agent-note">{selected().note}</div>
          </div>

          <textarea
            value={draft()}
            onInput={(event) => setDraft(event.currentTarget.value)}
            placeholder="例如：检查当前线路复测资料，列出缺失文件并给出下一步执行计划。"
          />

          <div class="workbench-composer__actions">
            <span>{emptyPrompt({ hasWorkspace: hasWorkspace(), hasModel: true })}</span>
            <button type="button" disabled={hasWorkspace() && !hasPrompt()} onClick={primary}>
              {primaryActionLabel({ hasWorkspace: hasWorkspace() })}
            </button>
          </div>
        </form>

        <section class="workbench-prompts" aria-label="示例任务">
          <h2>可以这样开始</h2>
          <div>
            <For each={promptExamples}>
              {(prompt) => (
                <button type="button" onClick={() => setDraft(prompt)}>
                  {prompt}
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="workbench-results" aria-label="会话产物">
          <h2>会话产物</h2>
          <p>开始会话后，文件检查、工具调用、报告草稿和风险提示会在这里持续更新。</p>
        </section>
      </section>

      <aside class="workbench-context" aria-label="Harness 状态">
        <section>
          <h2>Harness</h2>
          <dl class="workbench-facts">
            <div>
              <dt>运行模式</dt>
              <dd>本地安全模式</dd>
            </div>
            <div>
              <dt>当前模型</dt>
              <dd>{defaultModel}</dd>
            </div>
            <div>
              <dt>工作区</dt>
              <dd>{hasWorkspace() ? workspace() : "等待选择资料目录"}</dd>
            </div>
            <div>
              <dt>权限状态</dt>
              <dd>当前没有危险权限请求</dd>
            </div>
          </dl>
        </section>

        <section>
          <h2>能力集</h2>
          <div class="workbench-capabilities">
            <span>主控智能体</span>
            <span>测绘资料检查</span>
            <span>规范引用</span>
            <span>文件读取</span>
          </div>
        </section>

        <section>
          <h2>运行轨迹</h2>
          <ol class="workbench-timeline">
            <For each={events}>
              {(event) => (
                <li data-tone={event.tone}>
                  <strong>{event.title}</strong>
                  <span>{event.detail}</span>
                </li>
              )}
            </For>
          </ol>
        </section>
      </aside>
    </main>
  )
}
