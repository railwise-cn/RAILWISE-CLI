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
  agentRoleLabel,
  agentStudioSummary,
  modelSetupState,
  professionalSkills,
  recommendedModel,
  recommendedProviders,
} from "@/pages/agents/collaboration"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

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
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const setup = createMemo(() => modelSetupState({ connectedProviders: connected().length, visibleModels: visible().length }))
  const summary = createMemo(() => agentStudioSummary(agents()))
  const providersState = createMemo(() => {
    if (setup() === "ready") return { label: "已启用", tone: "enabled" as Tone }
    if (setup() === "models-hidden") return { label: "待启用模型", tone: "setup" as Tone }
    return { label: "待接入", tone: "setup" as Tone }
  })
  const status = createMemo(() => ({
    agents: loading() ? "同步中" : `${summary().total} 个可用`,
    tools: loading() ? "同步中" : `${tools().length} 个可用`,
    skills: loading() ? "同步中" : `${skills().length} 个可用`,
    workflows: loading() ? "同步中" : `${workflows().length} 个可用`,
    mcp: "按项目启用",
    providers: connected().length > 0 ? `${connected().length} 个已接入` : "待接入",
    harness: "本地安全模式",
  }))
  const catalog = createMemo(() => [
    {
      id: "agents" as const,
      label: "Agents",
      title: "智能体库",
      detail: `${summary().primary} 主控 / ${summary().collaborators} 专业智能体`,
      state: state(loading(), summary().total),
      description: "管理主控、审校、平差、资料整理、报告生成等专业智能体。",
      preview: visibleAgents()
        .slice(0, 4)
        .map((agent) => ({ title: agent.displayName ?? agent.name, meta: agentRoleLabel(agent) })),
      href: "/agents",
      action: summary().total > 0 ? "管理智能体" : "发现智能体",
    },
    {
      id: "tools" as const,
      label: "Tools",
      title: "工具链",
      detail: `${tools().length} 个工具`,
      state: state(loading(), tools().length),
      description: "文件读取、规范检索、测绘生产、报告导出等工具由 Harness 调度。",
      preview: tools()
        .slice(0, 4)
        .map((tool) => ({ title: tool.label, meta: groups[tool.group] })),
      href: "/agents#agent-tools",
      action: "查看工具",
    },
    {
      id: "skills" as const,
      label: "Skills",
      title: "专业流程",
      detail: `${skills().length} 个 Skills`,
      state: state(loading(), skills().length),
      description: "沉淀工程测绘作业方法、审查规则、交付流程和工具使用规范。",
      preview: professionalSkills(skills(), 4).map((skill) => ({ title: skill.name, meta: skill.description })),
      href: "/agents#agent-skills",
      action: "查看 Skills",
    },
    {
      id: "workflows" as const,
      label: "Workflows",
      title: "工作流",
      detail: `${workflows().length} 个工作流`,
      state: state(loading(), workflows().length, "待配置"),
      description: "把多个智能体串成外业首检、监测分析、汇报 PPT 和报告审校链路。",
      preview: workflows().slice(0, 4).map((workflow) => ({ title: workflow.name, meta: workflow.description })),
      href: "/agents#agent-workflows",
      action: "查看工作流",
    },
    {
      id: "mcp" as const,
      label: "MCP",
      title: "MCP 连接器",
      detail: "按项目启用",
      state: { label: "待配置", tone: "setup" as Tone },
      description: "连接知识库、专业系统和外部工具；权限和审计由 Harness 统一接管。",
      preview: [
        { title: "知识库连接", meta: "按项目授权" },
        { title: "专业系统", meta: "由 Harness 审计" },
        { title: "外部工具", meta: "权限确认后执行" },
      ],
      href: "/harness",
      action: "查看执行层",
    },
    {
      id: "providers" as const,
      label: "Providers",
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
      title: "Harness Profile",
      detail: "工作区 / 权限 / 审计",
      state: { label: "已启用", tone: "enabled" as Tone },
      description: "管理本地执行边界、权限确认、工具事件、问题回答和失败恢复。",
      preview: [
        { title: "工作区边界", meta: "本地文件夹" },
        { title: "权限闸门", meta: "高风险动作确认" },
        { title: "工具审计", meta: "执行时间线" },
      ],
      href: "/harness",
      action: "查看 Harness",
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
          <span class="agent-kicker">RAILWISE Marketplace</span>
          <h1>能力市场</h1>
          <p>安装、接入和管理智能体、工具、Skills、MCP、模型 Provider 与 Harness Profile。日常任务从工作台开始，这里只放能力配置。</p>
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

      <section class="agent-market-tabs" aria-label="能力市场分类" data-testid="agent-marketplace">
        <For each={catalog()}>
          {(item) => (
            <button
              type="button"
              classList={{ active: active() === item.id }}
              aria-pressed={active() === item.id}
              onClick={() => setActive(item.id)}
            >
              {item.label}
            </button>
          )}
        </For>
      </section>

      <section class="agent-market-panel" data-testid="agent-market-panel">
        <div>
          <span>{selected().label}</span>
          <h2>{selected().title}</h2>
          <p>{selected().description}</p>
          <div class="marketplace-panel-preview" data-testid={`marketplace-preview-${selected().id}`}>
            <For each={selected().preview.slice(0, 4)}>
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
        </div>
        <div class="agent-market-panel__status">
          <span class={`marketplace-state marketplace-state--${selected().state.tone}`} data-testid={`marketplace-state-${selected().id}`}>
            {selected().state.label}
          </span>
          <strong>{status()[selected().id]}</strong>
          <Show
            when={selected().button}
            fallback={
              <A href={selected().href ?? "/marketplace"} class="agent-button agent-button--ghost">
                {selected().action}
              </A>
            }
          >
            <button type="button" class="agent-button agent-button--ghost" onClick={connectProvider}>
              {selected().action}
            </button>
          </Show>
        </div>
      </section>

      <Show when={error()}>
        <p class="agent-error">{error()}</p>
      </Show>

      <section class="marketplace-grid" aria-busy={loading()}>
        <For each={catalog()}>
          {(item) => (
            <article class="marketplace-card" data-testid={`marketplace-card-${item.id}`}>
              <div>
                <div class="marketplace-card__head">
                  <span class="marketplace-card__label">{item.label}</span>
                  <span class={`marketplace-state marketplace-state--${item.state.tone}`} data-testid={`marketplace-card-state-${item.id}`}>
                    {item.state.label}
                  </span>
                </div>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
              </div>
              <div class="marketplace-preview">
                <For each={item.preview.slice(0, 3)}>
                  {(entry) => (
                    <span title={entry.meta}>
                      <strong>{entry.title}</strong>
                      <small>{entry.meta}</small>
                    </span>
                  )}
                </For>
                <Show when={!loading() && item.preview.length === 0}>
                  <span>
                    <strong>等待发现</strong>
                    <small>进入高级管理查看配置</small>
                  </span>
                </Show>
              </div>
              <div class="marketplace-card__footer">
                <small>{item.detail}</small>
                <Show
                  when={item.button}
                  fallback={
                    <A href={item.href ?? "/marketplace"} class="agent-button agent-button--ghost" data-testid={`marketplace-open-${item.id}`}>
                      {item.action}
                    </A>
                  }
                >
                  <button type="button" class="agent-button agent-button--ghost" data-testid={`marketplace-open-${item.id}`} onClick={connectProvider}>
                    {item.action}
                  </button>
                </Show>
              </div>
            </article>
          )}
        </For>
      </section>

      <section class="marketplace-provider-strip">
        <div>
          <h2>推荐模型接入</h2>
          <p>默认建议 {recommendedModel}，不同智能体可在高级管理里单独绑定模型。</p>
        </div>
        <div class="agent-provider-actions">
          <For each={recommendedProviders}>
            {(provider) => (
              <button type="button" onClick={() => connectPreferred(provider.id)}>
                接入 {provider.label}
              </button>
            )}
          </For>
        </div>
      </section>
    </main>
  )
}
