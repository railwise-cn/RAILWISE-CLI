import "@/pages/agents/agent-studio.css"
import { A } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import type { CapabilityManifest } from "@railwise/sdk/v2/client"
import { DialogConnectProvider } from "@/components/dialog-connect-provider"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useModels } from "@/context/models"
import { useProviders } from "@/hooks/use-providers"
import { useGlobalSDK } from "@/context/global-sdk"
import { useServer } from "@/context/server"
import { useAgentStudioApi } from "@/pages/agents/api"
import {
  agentRoleLabel,
  agentStudioSummary,
  modelSetupState,
  professionalSkills,
  recentWorkspaces,
  recommendedModel,
  recommendedProviders,
} from "@/pages/agents/collaboration"
import { agentDisplayName } from "@/utils/agent-display"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"
import {
  capabilitiesFor,
  capabilityCount,
  capabilityPreview,
  marketplaceIds,
  normalizeCapabilities,
  permissionSummary,
  riskLabel,
  sourceLabel,
  type MarketplaceId,
} from "./marketplace-state"

type Id = MarketplaceId
type Tone = "enabled" | "empty" | "loading" | "setup"

const groups: Record<ToolInventoryItem["group"], string> = {
  agent: "智能体协作",
  knowledge: "规范知识",
  survey: "测绘生产",
  core: "基础执行",
  extension: "扩展能力",
}

type Preview = { title: string; meta: string }

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
  const sdk = useGlobalSDK()
  const dialog = useDialog()
  const layout = useLayout()
  const models = useModels()
  const providers = useProviders()
  const server = useServer()
  const sync = useGlobalSync()
  const [agents, setAgents] = createSignal<AgentStudioItem[]>([])
  const [tools, setTools] = createSignal<ToolInventoryItem[]>([])
  const [skills, setSkills] = createSignal<SkillInventoryItem[]>([])
  const [workflows, setWorkflows] = createSignal<Workflow[]>([])
  const [capabilities, setCapabilities] = createSignal<CapabilityManifest[]>([])
  const [active, setActive] = createSignal<Id>("agents")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")

  function load() {
    setLoading(true)
    void Promise.allSettled([api.list(), api.tools(), api.skills(), api.presets(), sdk.client.marketplace.capabilities.list()])
      .then(([list, toolset, skillset, presets, registry]) => {
        setAgents(result(list, []))
        setTools(result(toolset, []))
        setSkills(result(skillset, []))
        setWorkflows(result(presets, []))
        setCapabilities(registry.status === "fulfilled" ? normalizeCapabilities(registry.value) : [])
        setError(list.status === "rejected" ? (list.reason instanceof Error ? list.reason.message : String(list.reason)) : "")
      })
      .finally(() => setLoading(false))
  }

  onMount(load)
  useAgentUpdates(load)

  const recent = createMemo(() => recentWorkspaces(sync.data.project, 1))
  const visibleAgents = createMemo(() => agents().filter((agent) => !agent.hidden))
  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const setup = createMemo(() => modelSetupState({ connectedProviders: connected().length, visibleModels: visible().length }))
  const summary = createMemo(() => agentStudioSummary(agents()))
  const count = (id: Id, value = 0) => Math.max(value, capabilityCount(capabilities(), id))
  const agentCount = createMemo(() => count("agents", summary().total))
  const toolCount = createMemo(() => count("tools", tools().length))
  const skillCount = createMemo(() => count("skills", skills().length))
  const workflowCount = createMemo(() => count("workflows", workflows().length))
  const mcpCount = createMemo(() => capabilityCount(capabilities(), "mcp"))
  const providerCount = createMemo(() => capabilityCount(capabilities(), "providers"))
  const harnessCount = createMemo(() => capabilityCount(capabilities(), "harness"))
  const providersState = createMemo(() => {
    if (setup() === "ready") return { label: "已启用", tone: "enabled" as Tone }
    if (setup() === "models-hidden") return { label: "待启用模型", tone: "setup" as Tone }
    return { label: "待接入", tone: "setup" as Tone }
  })
  const status = createMemo(() => ({
    agents: loading() ? "同步中" : `${agentCount()} 个可用`,
    tools: loading() ? "同步中" : `${toolCount()} 个可用`,
    skills: loading() ? "同步中" : `${skillCount()} 个可用`,
    workflows: loading() ? "同步中" : `${workflowCount()} 个可用`,
    mcp: mcpCount() > 0 ? `${mcpCount()} 个可配置` : "按项目启用",
    providers: connected().length > 0 ? `${connected().length} 个已接入` : providerCount() > 0 ? `${providerCount()} 个待接入` : "待接入",
    harness: harnessCount() > 0 ? "本地安全模式" : "待同步",
  }))
  const preview = (id: Id, items: Preview[]) => (items.length > 0 ? items : capabilityPreview(capabilities(), id))
  const catalog = createMemo(() => [
    {
      id: marketplaceIds[0],
      label: "智能体",
      title: "智能体库",
      detail: `${summary().primary} 入口 / ${summary().collaborators} 专业智能体`,
      state: state(loading(), agentCount()),
      description: "选择 RAILWISE 协作入口、审校、平差、资料整理、报告生成等专业智能体。",
      preview: preview(
        "agents",
        visibleAgents()
          .slice(0, 4)
          .map((agent) => ({ title: agentDisplayName(agent), meta: agentRoleLabel(agent) })),
      ),
      href: "/agents",
      action: agentCount() > 0 ? "打开智能体" : "发现智能体",
    },
    {
      id: marketplaceIds[1],
      label: "工具",
      title: "工具链",
      detail: `${toolCount()} 个工具`,
      state: state(loading(), toolCount()),
      description: "文件读取、规范检索、测绘生产、报告导出等工具由执行层调度。",
      preview: preview(
        "tools",
        tools()
          .slice(0, 4)
          .map((tool) => ({ title: tool.label, meta: groups[tool.group] })),
      ),
      href: "/agents#agent-tools",
      action: "查看工具",
    },
    {
      id: marketplaceIds[2],
      label: "流程",
      title: "专业流程",
      detail: `${skillCount()} 个流程`,
      state: state(loading(), skillCount()),
      description: "沉淀工程测绘作业方法、审查规则、交付流程和工具使用规范。",
      preview: preview(
        "skills",
        professionalSkills(skills(), 4).map((skill) => ({ title: skill.name, meta: skill.description })),
      ),
      href: "/agents#agent-skills",
      action: "查看流程",
    },
    {
      id: marketplaceIds[3],
      label: "工作流",
      title: "工作流",
      detail: `${workflowCount()} 个工作流`,
      state: state(loading(), workflowCount(), "待配置"),
      description: "把多个智能体串成外业首检、监测分析、汇报 PPT 和报告审校链路。",
      preview: preview(
        "workflows",
        workflows().slice(0, 4).map((workflow) => ({ title: workflow.name, meta: workflow.description })),
      ),
      href: "/agents#agent-workflows",
      action: "查看工作流",
    },
    {
      id: marketplaceIds[4],
      label: "MCP",
      title: "MCP 连接器",
      detail: mcpCount() > 0 ? `${mcpCount()} 个连接器` : "按项目启用",
      state: state(loading(), capabilitiesFor(capabilities(), "mcp").filter((item) => item.enabled).length, "待配置"),
      description: "连接知识库、专业系统和外部工具；权限和审计由执行层统一接管。",
      preview: preview("mcp", [
        { title: "知识库连接", meta: "按项目授权" },
        { title: "专业系统", meta: "由执行层审计" },
        { title: "外部工具", meta: "权限确认后执行" },
      ]),
      href: "/harness",
      action: "查看执行层",
    },
    {
      id: marketplaceIds[5],
      label: "模型",
      title: "模型 Provider",
      detail: setup() === "ready" ? `${visible().length} 个可见模型` : `默认建议 ${recommendedModel}`,
      state: providersState(),
      description: "接入 DeepSeek、OpenRouter 或 OpenAI 兼容模型，再按智能体分配模型。",
      preview: preview(
        "providers",
        connected().length > 0
          ? connected().slice(0, 4).map((provider) => ({ title: provider.name, meta: "已接入" }))
          : recommendedProviders.map((provider) => ({ title: provider.label, meta: "推荐接入" })),
      ),
      action: "接入模型",
      button: true,
    },
    {
      id: marketplaceIds[6],
      label: "执行层",
      title: "执行层配置",
      detail: "工作区 / 权限 / 审计",
      state: loading() ? { label: "同步中", tone: "loading" as Tone } : { label: "已启用", tone: "enabled" as Tone },
      description: "管理本地执行边界、权限确认、工具事件、问题回答和失败恢复。",
      preview: preview("harness", [
        { title: "工作区边界", meta: "本地文件夹" },
        { title: "权限闸门", meta: "高风险动作确认" },
        { title: "工具审计", meta: "执行时间线" },
      ]),
      href: "/harness",
      action: "查看执行层",
    },
  ])
  const selected = createMemo(() => catalog().find((item) => item.id === active()) ?? catalog()[0])
  const selectedCapabilities = createMemo(() => capabilitiesFor(capabilities(), selected().id))

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

  createEffect(() => {
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (!current) return
    layout.projects.open(current)
    if (server.projects.last() !== current) server.projects.touch(current)
  })

  return (
    <main class="agent-studio marketplace-page" data-testid="marketplace-page">
      <section class="marketplace-shell">
        <div class="marketplace-shell__copy">
          <span class="agent-kicker">RAILWISE 能力市场</span>
          <h1>能力市场</h1>
          <p>像插件市场一样管理智能体、工具、专业流程、MCP 与模型；需要执行任务时回到工作台。</p>
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
                  <small>打开配置</small>
                </span>
              </Show>
            </div>
            <Show when={selectedCapabilities().length > 0}>
              <div class="marketplace-panel-preview marketplace-panel-permissions" data-testid={`marketplace-permissions-${selected().id}`}>
                <For each={selectedCapabilities().slice(0, 3)}>
                  {(item) => (
                    <span title={`${item.description} · ${sourceLabel(item.source)}`}>
                      <strong>{item.name}</strong>
                      <small>{permissionSummary(item.permissions)} · {riskLabel(item.permissions)}</small>
                    </span>
                  )}
                </For>
              </div>
            </Show>
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
