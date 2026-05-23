import "./agent-studio.css"
import { A, useNavigate } from "@solidjs/router"
import type { CapabilityKind, CapabilityManifest, HarnessStatus } from "@railwise/sdk/v2"
import { Icon } from "@railwise/ui/icon"
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { DialogConnectProvider } from "@/components/dialog-connect-provider"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { useGlobalSDK } from "@/context/global-sdk"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import { useProviders } from "@/hooks/use-providers"
import { setSessionHandoff } from "@/pages/session/handoff"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import { useAgentStudioApi } from "./api"
import { effectiveCapabilities, starterCapabilities, updateStarterCapability } from "./capabilities"
import {
  agentRoleLabel,
  collaborationPlan,
  collaborationTarget,
  enabledSkillRows,
  modelRouteLabel,
  parseModelRoute,
  professionalSkills,
  recentWorkspaces,
  recommendedModel,
  recommendedProviders,
  updateAgentModelRoute,
} from "./collaboration"

type MarketFilter = CapabilityKind | "all"

const systemAgents = new Set(["build", "plan", "general", "explore", "compaction"])
const order = [
  "chief_manager",
  "source_ingestor",
  "norm_librarian",
  "knowledge_curator",
  "cpiii_specialist",
  "adjustment_computer",
  "railway_norm_consultant",
  "technical_writer",
  "qa_reviewer",
  "data_analyst",
]

const marketFilters: { value: MarketFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "agent", label: "智能体" },
  { value: "tool", label: "工具" },
  { value: "skill", label: "Skills" },
  { value: "workflow", label: "工作流" },
  { value: "provider", label: "模型" },
  { value: "mcp", label: "MCP" },
  { value: "harness_profile", label: "Harness" },
]

const prompts = [
  "检查当前线路复测资料，列出缺失文件、风险点和下一步执行计划。",
  "导入 CPIII 复测成果，核对规范限差，并生成质量审查摘要。",
  "把本周监测数据整理成报告草稿，突出超限点、趋势和处理建议。",
]

const descriptions: Record<string, string> = {
  chief_manager: "拆解工程任务、调度专业智能体、控制质量闸门，并汇总最终交付。",
  source_ingestor: "整理外部规范、项目资料和原始文件，准备可入库的资料上下文。",
  norm_librarian: "查询工程测量规范，返回可追溯条文、版本差异和报告引用依据。",
  knowledge_curator: "把规范、项目案例和审查记录沉淀为可检索的工程知识库。",
  cpiii_specialist: "处理 CPIII 控制网、轨道精调、限差核对和复测成果审查。",
  adjustment_computer: "调用确定性平差工具，输出残差、精度统计、粗差探测和质量标记。",
  railway_norm_consultant: "围绕铁路测量规范生成合规说明、条文对照和审查意见。",
  technical_writer: "把计算结果、规范引用和审查意见整理为中文技术报告。",
  qa_reviewer: "检查成果完整性、风险项、术语一致性和交付前质量问题。",
  data_analyst: "整理监测与测量数据，识别趋势、异常和统计摘要。",
}

function result<T>(value: PromiseSettledResult<T>, fallback: T) {
  if (value.status === "fulfilled") return value.value
  return fallback
}

function rank(agent: AgentStudioItem) {
  const index = order.indexOf(agent.name)
  if (index >= 0) return index
  return order.length + agent.name.localeCompare("zzzz")
}

function compactHome(value: string, home: string) {
  if (home && value === home) return "~"
  if (home && value.startsWith(home + "/")) return "~" + value.slice(home.length)
  return value
}

function kindLabel(kind: CapabilityKind) {
  if (kind === "agent") return "智能体"
  if (kind === "tool") return "工具"
  if (kind === "skill") return "Skill"
  if (kind === "workflow") return "工作流"
  if (kind === "provider") return "模型"
  if (kind === "mcp") return "MCP"
  return "Harness"
}

function modeLabel(mode: HarnessStatus["mode"]) {
  if (mode === "auto") return "自动执行"
  if (mode === "ask") return "询问确认"
  return "安全确认"
}

function permissionLabel(capability: CapabilityManifest) {
  const access = capability.permissions.filesystem === "read" ? "只读" : "读写"
  const items = [
    capability.permissions.filesystem !== "none" ? `文件${access}` : "",
    capability.permissions.network ? "网络" : "",
    capability.permissions.shell ? "命令" : "",
    capability.permissions.external_directory ? "外部目录" : "",
    capability.permissions.secrets ? "密钥" : "",
  ].filter(Boolean)
  if (!items.length) return "无敏感权限"
  return items.join(" / ")
}

function capabilityAgent(capability: CapabilityManifest): AgentStudioItem {
  const name = capability.id.replace("railwise.agent.", "")
  return {
    name,
    displayName: capability.name,
    description: descriptions[name] ?? capability.description,
    mode: name === "chief_manager" ? "primary" : "subagent",
    native: true,
    permission: {},
    options: {},
  }
}

function agentDescription(agent: AgentStudioItem | undefined) {
  if (!agent) return "接收任务并调度专业能力。"
  return descriptions[agent.name] ?? agent.description ?? "参与工程任务协作。"
}

export default function AgentsPage() {
  const api = useAgentStudioApi()
  const dialog = useDialog()
  const global = useGlobalSDK()
  const layout = useLayout()
  const models = useModels()
  const navigate = useNavigate()
  const platform = usePlatform()
  const providers = useProviders()
  const server = useServer()
  const sync = useGlobalSync()
  const [items, setItems] = createSignal<AgentStudioItem[]>([])
  const [tools, setTools] = createSignal<ToolInventoryItem[]>([])
  const [skills, setSkills] = createSignal<SkillInventoryItem[]>([])
  const [harness, setHarness] = createSignal<HarnessStatus>()
  const [capabilities, setCapabilities] = createSignal<CapabilityManifest[]>(starterCapabilities)
  const [directory, setDirectory] = createSignal("")
  const [manualDirectory, setManualDirectory] = createSignal(false)
  const [selectedAgent, setSelectedAgent] = createSignal("chief_manager")
  const [draft, setDraft] = createSignal("")
  const [query, setQuery] = createSignal("")
  const [filter, setFilter] = createSignal<MarketFilter>("all")
  const [loading, setLoading] = createSignal(true)
  const [marketLoading, setMarketLoading] = createSignal(true)
  const [error, setError] = createSignal("")
  const [marketError, setMarketError] = createSignal("")
  const [studioRemote, setStudioRemote] = createSignal(false)
  const [marketRemote, setMarketRemote] = createSignal(false)
  const [busy, setBusy] = createSignal("")
  const [routeSaving, setRouteSaving] = createSignal<Record<string, boolean>>({})

  function loadStudio() {
    setLoading(true)
    void Promise.allSettled([api.list(), api.tools(), api.skills()])
      .then(([agents, toolset, skillset]) => {
        if (agents.status === "fulfilled") {
          setItems(agents.value)
          setStudioRemote(true)
          setError("")
        } else {
          setStudioRemote(false)
          setError("智能体配置服务未连接，当前使用本地预置协作入口。")
        }
        setTools(result(toolset, []))
        setSkills(result(skillset, []))
      })
      .finally(() => setLoading(false))
  }

  async function loadHarness() {
    setMarketLoading(true)
    const [status, market] = await Promise.allSettled([
      global.client.harness.status(),
      global.client.marketplace.capabilities(),
    ])
    if (status.status === "fulfilled" && status.value.data) setHarness(status.value.data)
    if (market.status === "fulfilled" && market.value.data) {
      const data = effectiveCapabilities(market.value.data.data)
      setCapabilities(data)
      setMarketRemote(market.value.data.data.length > 0)
      setMarketError("")
    } else if (market.status === "rejected") {
      setMarketRemote(false)
      setMarketError("正在使用本地预置能力；连接服务器后会自动同步 Marketplace。")
    }
    setMarketLoading(false)
  }

  onMount(() => {
    loadStudio()
    void loadHarness()
  })
  useAgentUpdates(loadStudio)

  const recent = createMemo(() => recentWorkspaces(sync.data.project, 5))
  const productAgents = createMemo(() =>
    items()
      .filter((agent) => !agent.hidden && !systemAgents.has(agent.name))
      .sort((a, b) => rank(a) - rank(b)),
  )
  const fallbackAgents = createMemo(() =>
    capabilities()
      .filter((item) => item.kind === "agent")
      .map(capabilityAgent),
  )
  const agents = createMemo(() => (productAgents().length ? productAgents() : fallbackAgents()))
  const selected = createMemo(() => agents().find((agent) => agent.name === selectedAgent()) ?? agents()[0])
  const professionalTools = createMemo(() =>
    tools().length
      ? tools().map((tool) => ({ id: tool.id, label: tool.label, detail: tool.group }))
      : capabilities()
          .filter((item) => item.kind === "tool" && item.enabled)
          .map((item) => ({ id: item.id, label: item.name, detail: permissionLabel(item) })),
  )
  const professionalSkillList = createMemo(() =>
    professionalSkills(skills(), 8)
      .map((skill) => ({
        id: skill.location,
        label: skill.name,
        detail: skill.description,
      }))
      .concat(skills().length ? [] : enabledSkillRows(capabilities(), 8)),
  )
  const marketList = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return capabilities().filter((item) => {
      const kind = filter() === "all" || item.kind === filter()
      const found =
        !needle ||
        item.name.toLowerCase().includes(needle) ||
        item.description.toLowerCase().includes(needle) ||
        (item.tags ?? []).some((tag) => tag.toLowerCase().includes(needle))
      return kind && found
    })
  })
  const enabledCount = createMemo(() => capabilities().filter((item) => item.enabled).length)
  const enabledLabel = createMemo(() => (enabledCount() ? `${enabledCount()} 已启用` : "待配置"))
  const connectedProviders = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visibleModels = createMemo(() =>
    models
      .list()
      .filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id }))
      .sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.name.localeCompare(b.name)),
  )
  const modelOptions = createMemo(() =>
    visibleModels().map((model) => ({
      value: `${model.provider.id}/${model.id}`,
      label: `${model.provider.name} / ${model.name}`,
    })),
  )
  const routeAgent = createMemo(() => selected() ?? agents()[0])
  const canStart = createMemo(() => directory().trim().length > 0 && draft().trim().length > 0 && !!selectedAgent())
  const plan = createMemo(() =>
    collaborationPlan({
      agent: selected(),
      agents: agents(),
      capabilities: capabilities(),
      prompt: draft(),
    }),
  )

  const routeValue = (agent: AgentStudioItem) => {
    if (!agent.model) return ""
    return `${agent.model.providerID}/${agent.model.modelID}`
  }

  const routeOptions = (agent: AgentStudioItem) => {
    const current = routeValue(agent)
    if (!current || modelOptions().some((model) => model.value === current)) return modelOptions()
    return [{ value: current, label: `当前绑定 ${current}` }, ...modelOptions()]
  }

  const updateDirectory = (value: string) => {
    setManualDirectory(true)
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
          title: "选择项目文件夹",
          multiple: false,
        }),
      )
      return
    }
    dialog.show(
      () => <DialogSelectDirectory title="选择项目文件夹" onSelect={resolve} />,
      () => resolve(null),
    )
  }

  const connectProvider = () => {
    dialog.show(() => <DialogSelectProvider />)
  }

  const connectPreferred = (id: string) => {
    if (!providers.all().some((provider) => provider.id === id)) {
      connectProvider()
      return
    }
    dialog.show(() => <DialogConnectProvider provider={id} />)
  }

  const updateRouteSaving = (name: string, saving: boolean) => {
    setRouteSaving((state) => {
      if (saving) return { ...state, [name]: true }
      const next = { ...state }
      delete next[name]
      return next
    })
  }

  const saveRoute = async (agent: AgentStudioItem, value: string) => {
    const route = parseModelRoute(value)
    if (value && !route) return
    updateRouteSaving(agent.name, true)
    try {
      const detail = await api.detail(agent.name)
      await api.update(agent.name, updateAgentModelRoute(detail.rawMarkdown, value))
      setItems((current) => current.map((item) => (item.name === agent.name ? { ...item, model: route } : item)))
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      updateRouteSaving(agent.name, false)
    }
  }

  const updateCapability = (capability: CapabilityManifest) => {
    setCapabilities((current) => current.map((item) => (item.id === capability.id ? capability : item)))
  }

  const changeCapability = async (
    capability: CapabilityManifest,
    action: "enable" | "disable" | "install" | "uninstall",
  ) => {
    setBusy(capability.id)
    try {
      const result =
        action === "install"
          ? await global.client.marketplace.capability.install({ id: capability.id })
          : action === "uninstall"
            ? await global.client.marketplace.capability.uninstall({ id: capability.id })
            : action === "enable"
              ? await global.client.marketplace.capability.enable({ id: capability.id })
              : await global.client.marketplace.capability.disable({ id: capability.id })
      if (result.data) updateCapability(result.data)
      setMarketError("")
    } catch (err) {
      if (!marketRemote()) {
        const patch =
          action === "install"
            ? { installed: true, enabled: false }
            : action === "uninstall"
              ? { installed: false, enabled: false }
              : { enabled: action === "enable" }
        setCapabilities((current) => updateStarterCapability(current, capability.id, patch))
        setMarketError("服务器未连接，已临时更新本地预置能力；连接后会同步真实状态。")
        return
      }
      setMarketError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy("")
    }
  }

  const startCollaboration = () => {
    if (!canStart()) return
    const target = collaborationTarget({
      directory: directory(),
      agent: selectedAgent(),
      prompt: draft(),
    })
    layout.projects.open(target.directory)
    server.projects.touch(target.directory)
    setSessionHandoff(target.key, { prompt: target.prompt })
    navigate(target.href)
  }

  createEffect(() => {
    if (manualDirectory() || directory()) return
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (current) setDirectory(current)
  })

  createEffect(() => {
    if (agents().some((agent) => agent.name === selectedAgent())) return
    const chief = agents().find((agent) => agent.name === "chief_manager")
    const first = chief ?? agents()[0]
    if (first) setSelectedAgent(first.name)
  })

  return (
    <main class="agent-studio railwise-codex" data-testid="agents-page">
      <aside class="rw-sidebar">
        <div class="rw-brand">
          <span>RAILWISE</span>
          <strong>工程智能体</strong>
        </div>

        <section class="rw-panel rw-workspace">
          <div class="rw-panel__bar">
            <span>项目文件夹</span>
            <button type="button" class="rw-icon-button" onClick={chooseDirectory} aria-label="选择项目文件夹">
              <Icon name="folder" size="small" />
            </button>
          </div>
          <input
            data-testid="agent-project-directory"
            value={directory()}
            onInput={(event) => updateDirectory(event.currentTarget.value)}
            placeholder="/Users/name/CODE/project"
          />
          <Show when={recent().length}>
            <div class="rw-recent">
              <For each={recent()}>
                {(project) => (
                  <button type="button" title={project.worktree} onClick={() => updateDirectory(project.worktree)}>
                    {compactHome(project.worktree, sync.data.path.home)}
                  </button>
                )}
              </For>
            </div>
          </Show>
        </section>

        <section class="rw-panel">
          <div class="rw-panel__bar">
            <span>Harness</span>
            <strong>{harness() ? modeLabel(harness()!.mode) : marketLoading() ? "同步中" : "本地安全"}</strong>
          </div>
          <div class="rw-harness-grid">
            <div>
              <span>能力</span>
              <strong>{enabledLabel()}</strong>
            </div>
            <div>
              <span>权限</span>
              <strong>
                {harness()?.pendingPermissionCount ? `${harness()!.pendingPermissionCount} 待确认` : "无待处理"}
              </strong>
            </div>
            <div>
              <span>执行</span>
              <strong>{harness()?.runningToolCount ? `${harness()!.runningToolCount} 运行中` : "空闲"}</strong>
            </div>
          </div>
        </section>
      </aside>

      <section class="rw-main">
        <header class="rw-header">
          <div>
            <span>RAILWISE 智能体 Harness</span>
            <h1>把工程任务交给一组专业智能体</h1>
          </div>
          <button type="button" class="agent-button" onClick={connectProvider}>
            <Icon name="plus-small" size="small" />
            接入模型
          </button>
        </header>

        <section class="rw-composer" data-testid="agent-collaboration-start">
          <div class="rw-thread">
            <div class="rw-chat-head">
              <div>
                <span>工程任务对话</span>
                <h2>告诉智能体要完成什么，其余交给 Harness 编排</h2>
              </div>
              <p>权限、工具和技能由 Harness 在后台编排；遇到敏感操作会进入会话确认。</p>
            </div>
            <div class="rw-message rw-message--assistant">
              <strong>项目总控</strong>
              <p>
                {selected()?.displayName ?? "项目总控"} 将作为入口接收任务，Harness 会按权限策略调度文件、工具、Skills
                和专业智能体。
              </p>
            </div>
            <div class="rw-plan" data-testid="agent-harness-plan">
              <div class="rw-plan__head">
                <span>Harness 调度预案</span>
                <strong>{draft().trim() ? "按当前任务更新" : "输入任务后自动细化"}</strong>
              </div>
              <div class="rw-plan__steps">
                <For each={plan()}>
                  {(item, index) => (
                    <div>
                      <span>{index() + 1}</span>
                      <strong>{item.label}</strong>
                      <small>{item.detail}</small>
                    </div>
                  )}
                </For>
              </div>
            </div>
            <form
              class="rw-prompt"
              onSubmit={(event) => {
                event.preventDefault()
                startCollaboration()
              }}
            >
              <div class="rw-prompt__bar">
                <label>
                  <span>协作智能体</span>
                  <select
                    data-testid="agent-collaboration-agent"
                    value={selectedAgent()}
                    onInput={(event) => setSelectedAgent(event.currentTarget.value)}
                  >
                    <For each={agents()}>
                      {(agent) => (
                        <option value={agent.name}>
                          {agent.displayName ?? agent.name} · {agentRoleLabel(agent)}
                        </option>
                      )}
                    </For>
                  </select>
                </label>
                <button type="submit" class="agent-button" data-testid="agent-start-session" disabled={!canStart()}>
                  <Icon name="check-small" size="small" />
                  开始
                </button>
              </div>
              <textarea
                data-testid="agent-collaboration-prompt"
                value={draft()}
                onInput={(event) => setDraft(event.currentTarget.value)}
                placeholder="输入工程任务，例如：检查当前线路复测资料，列出缺失文件并生成下一步执行计划。"
              />
            </form>
          </div>
          <div class="rw-prompt-bank">
            <For each={prompts}>
              {(prompt) => (
                <button type="button" onClick={() => setDraft(prompt)}>
                  {prompt}
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="rw-agent-list" aria-busy={loading()}>
          <div class="rw-section-title">
            <span>专业智能体</span>
            <strong>{agents().length} 个可用</strong>
          </div>
          <div class="rw-agent-row">
            <For each={agents()}>
              {(agent) => (
                <button
                  type="button"
                  classList={{ active: selectedAgent() === agent.name }}
                  onClick={() => setSelectedAgent(agent.name)}
                >
                  <span>{agentRoleLabel(agent)}</span>
                  <strong>{agent.displayName ?? agent.name}</strong>
                  <small>{agentDescription(agent)}</small>
                </button>
              )}
            </For>
          </div>
        </section>

        <section class="rw-market">
          <div class="rw-section-title">
            <div>
              <span>能力市场</span>
              <strong>
                {marketRemote() ? `${capabilities().length} 项能力` : `本地预置 ${capabilities().length} 项能力`}
              </strong>
            </div>
            <label>
              <Icon name="magnifying-glass" size="small" />
              <input value={query()} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="搜索能力" />
            </label>
          </div>
          <nav class="rw-market-nav" aria-label="能力市场分类">
            <For each={marketFilters}>
              {(item) => (
                <button
                  type="button"
                  data-testid={`market-filter-${item.value}`}
                  classList={{ active: filter() === item.value }}
                  onClick={() => setFilter(item.value)}
                >
                  {item.label}
                </button>
              )}
            </For>
          </nav>
          <Show when={marketError()}>
            <p class={marketRemote() ? "agent-error" : "agent-empty"}>{marketError()}</p>
          </Show>
          <div class="rw-market-grid" aria-busy={marketLoading()}>
            <For each={marketList()}>
              {(capability) => (
                <article
                  class="rw-capability"
                  data-testid={`market-capability-${capability.id}`}
                  classList={{ disabled: !capability.enabled }}
                >
                  <div class="rw-capability__top">
                    <span>{kindLabel(capability.kind)}</span>
                    <strong>{!capability.installed ? "未安装" : capability.enabled ? "已启用" : "可启用"}</strong>
                  </div>
                  <h2>{capability.name}</h2>
                  <p>{capability.description}</p>
                  <small>{permissionLabel(capability)}</small>
                  <div class="rw-tags">
                    <For each={capability.tags ?? []}>{(tag) => <span>{tag}</span>}</For>
                  </div>
                  <div class="rw-capability__actions">
                    <button
                      type="button"
                      class="agent-button agent-button--ghost"
                      data-testid={`market-capability-toggle-${capability.id}`}
                      disabled={busy() === capability.id}
                      onClick={() =>
                        void changeCapability(
                          capability,
                          !capability.installed ? "install" : capability.enabled ? "disable" : "enable",
                        )
                      }
                    >
                      {busy() === capability.id
                        ? "处理中"
                        : !capability.installed
                          ? "安装"
                          : capability.enabled
                            ? "停用"
                            : "启用"}
                    </button>
                    <Show when={capability.installed && !capability.enabled}>
                      <button
                        type="button"
                        class="agent-button agent-button--ghost"
                        data-testid={`market-capability-uninstall-${capability.id}`}
                        disabled={busy() === capability.id}
                        onClick={() => void changeCapability(capability, "uninstall")}
                      >
                        卸载
                      </button>
                    </Show>
                  </div>
                </article>
              )}
            </For>
          </div>
          <Show when={!marketLoading() && marketList().length === 0}>
            <div class="agent-empty">没有匹配的能力。</div>
          </Show>
        </section>
      </section>

      <aside class="rw-inspector">
        <section class="rw-panel rw-agent-profile">
          <div class="rw-panel__bar">
            <span>当前智能体</span>
            <A href={`/agents/${selectedAgent()}`}>配置</A>
          </div>
          <h2>{selected()?.displayName ?? selected()?.name ?? "项目总控"}</h2>
          <p>{agentDescription(selected())}</p>
          <small>@{selectedAgent()}</small>
        </section>

        <section class="rw-panel">
          <div class="rw-panel__bar">
            <span>模型路由</span>
            <strong>{connectedProviders().length ? `${connectedProviders().length} 个模型源` : "未接入"}</strong>
          </div>
          <Show
            when={visibleModels().length > 0 ? routeAgent() : undefined}
            fallback={
              <div class="rw-model-empty">
                <strong>默认建议 {recommendedModel}</strong>
                <div class="agent-provider-actions">
                  <For each={recommendedProviders}>
                    {(provider) => (
                      <button type="button" onClick={() => connectPreferred(provider.id)}>
                        接入 {provider.label}
                      </button>
                    )}
                  </For>
                </div>
              </div>
            }
          >
            {(agent) => (
              <label class="rw-route">
                <span>{modelRouteLabel(agent())}</span>
                <select
                  value={routeValue(agent())}
                  disabled={routeSaving()[agent().name] || (!modelOptions().length && !routeValue(agent()))}
                  onInput={(event) => void saveRoute(agent(), event.currentTarget.value)}
                >
                  <option value="">默认 {recommendedModel}</option>
                  <For each={routeOptions(agent())}>
                    {(model) => <option value={model.value}>{model.label}</option>}
                  </For>
                </select>
              </label>
            )}
          </Show>
        </section>

        <section class="rw-panel">
          <div class="rw-panel__bar">
            <span>工具</span>
            <strong>{professionalTools().length ? `${professionalTools().length} 项` : "按任务加载"}</strong>
          </div>
          <div class="rw-mini-list">
            <For each={professionalTools().slice(0, 7)}>
              {(tool) => (
                <div data-testid="agent-tool-item">
                  <strong>{tool.label}</strong>
                  <small>{tool.detail}</small>
                </div>
              )}
            </For>
          </div>
        </section>

        <section class="rw-panel">
          <div class="rw-panel__bar">
            <span>Skills</span>
            <strong>{professionalSkillList().length ? `${professionalSkillList().length} 项` : "按任务加载"}</strong>
          </div>
          <div class="rw-mini-list">
            <For each={professionalSkillList().slice(0, 6)}>
              {(skill) => (
                <div data-testid="agent-skill-item">
                  <strong>{skill.label}</strong>
                  <small>{skill.detail}</small>
                </div>
              )}
            </For>
            <Show when={!professionalSkillList().length}>
              <div>
                <strong>从能力市场启用 Skill</strong>
                <small>复测检查、平差分析、规范速查、报告交付</small>
              </div>
            </Show>
          </div>
        </section>

        <Show when={error()}>
          <p class={studioRemote() ? "agent-error" : "agent-empty"}>{error()}</p>
        </Show>
      </aside>
    </main>
  )
}
