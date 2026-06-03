import "@/pages/agents/agent-studio.css"
import { A } from "@solidjs/router"
import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogConnectProvider } from "@/components/dialog-connect-provider"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import { useModels } from "@/context/models"
import { useProviders } from "@/hooks/use-providers"
import { useAgentStudioApi } from "@/pages/agents/api"
import {
  agentDisplayName,
  agentRoleLabel,
  agentStudioSummary,
  builtinAgents,
  builtinSkills,
  builtinTools,
  builtinWorkflows,
  modelSetupState,
  professionalSkills,
  recommendedModel,
  recommendedProviders,
} from "@/pages/agents/collaboration"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"
import { Icon } from "@railwise/ui/icon"

const ids = ["agents", "tools", "skills", "workflows", "mcp", "providers", "harness"] as const
type Id = (typeof ids)[number]
type Tone = "enabled" | "empty" | "loading" | "setup"

const groups: Record<ToolInventoryItem["group"], string> = {
  agent: "智能体协作",
  knowledge: "规范知识",
  survey: "测绘生产",
  core: "基础执行",
  extension: "扩展能力",
}

const icons = {
  agents: "brain",
  tools: "settings-gear",
  skills: "checklist",
  workflows: "branch",
  mcp: "mcp",
  providers: "models",
  harness: "circle-ban-sign",
} as const

function result<T>(value: PromiseSettledResult<T>, fallback: T) {
  if (value.status === "fulfilled") return value.value
  return fallback
}

function state(loading: boolean, count: number, empty = "待发现") {
  if (loading) return { label: "同步中", tone: "loading" as Tone }
  if (count > 0) return { label: "已启用", tone: "enabled" as Tone }
  return { label: empty, tone: "empty" as Tone }
}

export default function MarketplacePage() {
  const api = useAgentStudioApi()
  const dialog = useDialog()
  const models = useModels()
  const providers = useProviders()
  const [agents, setAgents] = createSignal<AgentStudioItem[]>([])
  const [tools, setTools] = createSignal<ToolInventoryItem[]>([])
  const [skills, setSkills] = createSignal<SkillInventoryItem[]>([])
  const [workflows, setWorkflows] = createSignal<Workflow[]>([])
  const [active, setActive] = createSignal<Id>("agents")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")

  function load() {
    setLoading(true)
    void Promise.allSettled([api.list(), api.tools(), api.skills(), api.presets()])
      .then(([list, toolset, skillset, presets]) => {
        setAgents(result(list, []))
        setTools(result(toolset, []))
        setSkills(result(skillset, []))
        setWorkflows(result(presets, []))
        setError(list.status === "rejected" ? (list.reason instanceof Error ? list.reason.message : String(list.reason)) : "")
      })
      .finally(() => setLoading(false))
  }

  onMount(load)
  useAgentUpdates(load)

  const visibleAgents = createMemo(() => agents().filter((agent) => !agent.hidden))
  const displayAgents = createMemo(() => (visibleAgents().length > 0 ? visibleAgents() : builtinAgents))
  const displayTools = createMemo(() => (tools().length > 0 ? tools() : builtinTools))
  const displaySkills = createMemo(() => (skills().length > 0 ? skills() : builtinSkills))
  const displayWorkflows = createMemo(() => (workflows().length > 0 ? workflows() : builtinWorkflows))
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const setup = createMemo(() => modelSetupState({ connectedProviders: connected().length, visibleModels: visible().length }))
  const summary = createMemo(() => agentStudioSummary(displayAgents()))
  const providersState = createMemo(() => {
    if (setup() === "ready") return { label: "已启用", tone: "enabled" as Tone }
    if (setup() === "models-hidden") return { label: "待启用模型", tone: "setup" as Tone }
    return { label: "待接入", tone: "setup" as Tone }
  })
  const status = createMemo(() => ({
    agents: loading() ? "同步中" : `${summary().total} 个可用`,
    tools: loading() ? "同步中" : `${displayTools().length} 个可用`,
    skills: loading() ? "同步中" : `${displaySkills().length} 个可用`,
    workflows: loading() ? "同步中" : `${displayWorkflows().length} 个可用`,
    mcp: "按项目启用",
    providers: connected().length > 0 ? `${connected().length} 个已接入` : "待接入",
    harness: "本地安全模式",
  }))
  const catalog = createMemo(() => [
    {
      id: "agents" as const,
      label: "智能体",
      title: "智能体库",
      detail: `${summary().primary} 总工程师 / ${summary().collaborators} 专业智能体`,
      state: state(loading(), summary().total),
      description: "选择总工程师、审校、平差、资料整理、报告生成等专业智能体。",
      preview: displayAgents()
        .slice(0, 8)
        .map((agent) => ({ title: agentDisplayName(agent), meta: `${agentRoleLabel(agent)} · @${agent.name}` })),
      href: "/agents",
      action: summary().total > 0 ? "管理智能体" : "发现智能体",
    },
    {
      id: "tools" as const,
      label: "工具",
      title: "工具链",
      detail: `${displayTools().length} 个工具`,
      state: state(loading(), displayTools().length),
      description: "文件读取、规范检索、测绘生产、报告导出等工具由执行层调度。",
      preview: displayTools()
        .slice(0, 10)
        .map((tool) => ({ title: tool.label, meta: groups[tool.group] })),
      href: "/agents#agent-tools",
      action: "查看工具",
    },
    {
      id: "skills" as const,
      label: "技能",
      title: "Skills 专业技能",
      detail: `${displaySkills().length} 个技能`,
      state: state(loading(), displaySkills().length),
      description: "沉淀工程测绘作业方法、审查规则、交付模板和工具使用规范。",
      preview: professionalSkills(displaySkills(), 12).map((skill) => ({ title: skill.name, meta: skill.description })),
      href: "/agents#agent-skills",
      action: "查看技能",
    },
    {
      id: "workflows" as const,
      label: "工作流",
      title: "工作流",
      detail: `${displayWorkflows().length} 个工作流`,
      state: state(loading(), displayWorkflows().length, "待配置"),
      description: "把多个智能体串成外业首检、监测分析、汇报 PPT 和报告审校链路。",
      preview: displayWorkflows().slice(0, 8).map((workflow) => ({ title: workflow.name, meta: workflow.description })),
      href: "/agents#agent-workflows",
      action: "查看工作流",
    },
    {
      id: "mcp" as const,
      label: "MCP",
      title: "MCP 连接器",
      detail: "按项目启用",
      state: { label: "待配置", tone: "setup" as Tone },
      description: "连接知识库、专业系统和外部工具；权限和审计由执行层统一接管。",
      preview: [
        { title: "知识库连接", meta: "按项目授权" },
        { title: "专业系统", meta: "由执行层审计" },
        { title: "外部工具", meta: "权限确认后执行" },
      ],
      href: "/harness",
      action: "查看执行层",
    },
    {
      id: "providers" as const,
      label: "模型",
      title: "模型 Provider",
      detail: setup() === "ready" ? `${visible().length} 个可见模型` : `默认建议 ${recommendedModel}`,
      state: providersState(),
      description: "接入 DeepSeek、OpenRouter 或 OpenAI 兼容模型，再按智能体分配模型。",
      preview:
        connected().length > 0
          ? connected().slice(0, 4).map((provider) => ({ title: provider.name, meta: "已接入" }))
          : recommendedProviders.map((provider) => ({ title: provider.label, meta: "推荐接入" })),
      action: "接入模型",
      button: true,
    },
    {
      id: "harness" as const,
      label: "Harness",
      title: "Harness 执行层",
      detail: "工作区 / 权限 / 审计",
      state: { label: "已启用", tone: "enabled" as Tone },
      description: "管理本地执行边界、权限确认、工具事件、问题回答和失败恢复。",
      preview: [
        { title: "工作区边界", meta: "本地文件夹" },
        { title: "权限闸门", meta: "高风险动作确认" },
        { title: "工具审计", meta: "执行时间线" },
      ],
      href: "/harness",
      action: "查看执行层",
    },
  ])
  const selected = createMemo(() => catalog().find((item) => item.id === active()) ?? catalog()[0])

  function connectProvider() {
    dialog.show(() => <DialogSelectProvider />)
  }

  function connectPreferred(id: string) {
    if (!providers.all().some((provider) => provider.id === id)) {
      connectProvider()
      return
    }
    dialog.show(() => <DialogConnectProvider provider={id} />)
  }

  return (
    <main class="agent-studio marketplace-page" data-testid="marketplace-page">
      <section class="marketplace-shell">
        <div class="marketplace-shell__copy">
          <span class="agent-kicker">RAILWISE 能力市场</span>
          <h1>能力市场</h1>
          <p>像 Codex 一样管理可安装能力：智能体、工具、Skills、工作流、MCP、模型与 Harness。日常协作仍从首页对话框开始。</p>
        </div>
        <div class="marketplace-shell__actions">
          <A href="/home" class="agent-button agent-button--ghost">
            返回工作台
          </A>
          <button type="button" class="agent-button" onClick={connectProvider}>
            接入模型
          </button>
        </div>
      </section>

      <Show when={error()}>
        <p class="agent-error">{error()}</p>
      </Show>

      <section class="marketplace-console" aria-busy={loading()}>
        <nav class="agent-market-tabs" aria-label="能力市场分类" data-testid="agent-marketplace">
          <For each={catalog()}>
            {(item) => (
              <button
                type="button"
                classList={{ active: active() === item.id }}
                aria-pressed={active() === item.id}
                data-testid={`marketplace-row-${item.id}`}
                onClick={() => setActive(item.id)}
              >
                <Icon name={icons[item.id]} size="small" />
                <span class="marketplace-row__label">{item.label}</span>
                <strong>{item.title}</strong>
                <small>{item.detail}</small>
                <span class={`marketplace-state marketplace-state--${item.state.tone}`} data-testid={`marketplace-row-state-${item.id}`}>
                  {item.state.label}
                </span>
              </button>
            )}
          </For>
        </nav>

        <section class="agent-market-panel" data-testid="agent-market-panel">
          <div>
            <span>{selected().label}</span>
            <h2>{selected().title}</h2>
            <p>{selected().description}</p>
            <div class="marketplace-panel-preview" data-testid={`marketplace-preview-${selected().id}`}>
              <For each={selected().preview.slice(0, 12)}>
                {(item) => (
                  <span title={item.meta}>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </span>
                )}
              </For>
              <Show when={!loading() && selected().preview.length === 0}>
                <span>
                  <strong>等待发现</strong>
                  <small>进入高级管理查看配置</small>
                </span>
              </Show>
            </div>
            <Show when={selected().id === "providers"}>
              <div class="agent-provider-actions" data-testid="marketplace-provider-actions">
                <For each={recommendedProviders}>
                  {(provider) => (
                    <button type="button" onClick={() => connectPreferred(provider.id)}>
                      接入 {provider.label}
                    </button>
                  )}
                </For>
              </div>
            </Show>
          </div>
          <div class="agent-market-panel__status">
            <span class={`marketplace-state marketplace-state--${selected().state.tone}`} data-testid={`marketplace-state-${selected().id}`}>
              {selected().state.label}
            </span>
            <strong>{status()[selected().id]}</strong>
            <Show
              when={selected().button}
              fallback={
                <A href={selected().href ?? "/marketplace"} class="agent-button agent-button--ghost" data-testid={`marketplace-open-${selected().id}`}>
                  {selected().action}
                </A>
              }
            >
              <button type="button" class="agent-button agent-button--ghost" data-testid={`marketplace-open-${selected().id}`} onClick={connectProvider}>
                {selected().action}
              </button>
            </Show>
          </div>
        </section>
      </section>
    </main>
  )
}
