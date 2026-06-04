import "./agent-studio.css"
import { A, useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js"
import { useDialog } from "@railwise/ui/context/dialog"
import { AgentCard } from "@/components/agent-card"
import { DialogConnectProvider } from "@/components/dialog-connect-provider"
import { DialogSelectDirectory } from "@/components/dialog-select-directory"
import { DialogSelectProvider } from "@/components/dialog-select-provider"
import { WorkflowGallery } from "@/components/workflow-gallery"
import { DateTime } from "luxon"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import { useProviders } from "@/hooks/use-providers"
import { Icon } from "@railwise/ui/icon"
import { setSessionHandoff } from "@/pages/session/handoff"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"
import { useAgentStudioApi } from "./api"
import {
  agentRoleLabel,
  agentStudioSummary,
  collaborationTarget,
  modelRouteLabel,
  modelRoutingSummary,
  modelSetupState,
  parseModelRoute,
  professionalSkills,
  recentWorkspaces,
  recommendedModel,
  recommendedProviders,
  updateAgentModelRoute,
} from "./collaboration"

const modes = [
  { value: "all", label: "全部" },
  { value: "primary", label: "主控智能体" },
  { value: "collaborator", label: "专业智能体" },
] as const
type ModeFilter = (typeof modes)[number]["value"]

const groups: Record<ToolInventoryItem["group"], string> = {
  agent: "智能体协作",
  knowledge: "规范知识",
  survey: "测绘生产",
  core: "基础执行",
  extension: "扩展能力",
}

const focus = [
  "chief_manager",
  "cpiii_specialist",
  "adjustment_computer",
  "norm_librarian",
  "knowledge_curator",
  "source_ingestor",
]

const marketIds = ["agents", "tools", "skills", "workflows", "mcp", "providers", "harness"] as const
type MarketId = (typeof marketIds)[number]

function result<T>(value: PromiseSettledResult<T>, fallback: T) {
  if (value.status === "fulfilled") return value.value
  return fallback
}

export default function AgentsPage() {
  const api = useAgentStudioApi()
  const dialog = useDialog()
  const layout = useLayout()
  const navigate = useNavigate()
  const models = useModels()
  const platform = usePlatform()
  const providers = useProviders()
  const server = useServer()
  const sync = useGlobalSync()
  const [items, setItems] = createSignal<AgentStudioItem[]>([])
  const [tools, setTools] = createSignal<ToolInventoryItem[]>([])
  const [skills, setSkills] = createSignal<SkillInventoryItem[]>([])
  const [workflows, setWorkflows] = createSignal<Workflow[]>([])
  const [directory, setDirectory] = createSignal("")
  const [manualDirectory, setManualDirectory] = createSignal(false)
  const [selectedAgent, setSelectedAgent] = createSignal("chief_manager")
  const [draft, setDraft] = createSignal("")
  const [query, setQuery] = createSignal("")
  const [mode, setMode] = createSignal<ModeFilter>("all")
  const [activeMarket, setActiveMarket] = createSignal<MarketId>("agents")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")
  const [routeSaving, setRouteSaving] = createSignal<Record<string, boolean>>({})

  function load() {
    setLoading(true)
    void Promise.allSettled([api.list(), api.tools(), api.skills(), api.presets()])
      .then(([agents, toolset, skillset, presets]) => {
        if (agents.status === "fulfilled") {
          setItems(agents.value)
          setError("")
        } else {
          setError(agents.reason instanceof Error ? agents.reason.message : String(agents.reason))
        }
        setTools(result(toolset, []))
        setSkills(result(skillset, []))
        setWorkflows(result(presets, []))
      })
      .finally(() => setLoading(false))
  }

  onMount(load)
  useAgentUpdates(load)

  const recent = createMemo(() =>
    recentWorkspaces(sync.data.project, 4),
  )
  const summary = createMemo(() => agentStudioSummary(items()))
  const collaborators = createMemo(() =>
    items()
      .slice()
      .sort(
        (a, b) =>
          Number(a.mode !== "primary") - Number(b.mode !== "primary") ||
          a.name.localeCompare(b.name, "zh-Hans-CN"),
      ),
  )
  const featured = createMemo(() =>
    focus
      .map((name) => items().find((agent) => agent.name === name))
      .filter((agent): agent is AgentStudioItem => Boolean(agent))
      .slice(0, 6),
  )
  const grouped = createMemo(() =>
    (Object.keys(groups) as ToolInventoryItem["group"][])
      .map((group) => ({
        group,
        label: groups[group],
        items: tools().filter((tool) => tool.group === group),
      }))
      .filter((group) => group.items.length > 0),
  )
  const visibleSkills = createMemo(() => professionalSkills(skills(), 12))
  const visibleModels = createMemo(() =>
    models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })),
  )
  const connectedProviders = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const routeSummary = createMemo(() => modelRoutingSummary(items()))
  const selectedProject = createMemo(() => recent().find((project) => project.worktree === directory()))
  const selectedName = createMemo(() => projectName(directory()))
  const selectedMeta = createMemo(() => {
    const project = selectedProject()
    if (project) return DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative() ?? "最近使用"
    if (directory()) return "本地工作区"
    return "先选择项目"
  })
  const activeAgent = createMemo(() => collaborators().find((agent) => agent.name === selectedAgent()))
  const serverDotClass = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "agent-status-dot--ready"
    if (healthy === false) return "agent-status-dot--blocked"
    return "agent-status-dot--idle"
  })
  const serverLabel = createMemo(() => {
    const healthy = server.healthy()
    if (healthy === true) return "已连接"
    if (healthy === false) return "待连接"
    return "检查中"
  })
  const setupState = createMemo(() =>
    modelSetupState({ connectedProviders: connectedProviders().length, visibleModels: visibleModels().length }),
  )
  const agentStatus = createMemo(() => {
    if (loading()) return "同步中"
    if (summary().total > 0) return `${summary().total} 个可用`
    return "等待安装"
  })
  const toolStatus = createMemo(() => {
    if (loading()) return "同步中"
    if (tools().length > 0) return `${tools().length} 个可用`
    return "等待安装"
  })
  const skillStatus = createMemo(() => {
    if (loading()) return "同步中"
    if (skills().length > 0) return `${skills().length} 个可用`
    return "等待安装"
  })
  const workflowStatus = createMemo(() => {
    if (loading()) return "同步中"
    if (workflows().length > 0) return `${workflows().length} 个可用`
    return "等待配置"
  })
  const market = createMemo(() => [
    {
      id: "agents" as const,
      label: "智能体",
      title: "智能体库",
      status: agentStatus(),
      description: "主控智能体负责拆解任务，专业智能体负责规范、平差、资料整理和报告产出。",
      target: "#agent-library",
      action: "查看智能体",
    },
    {
      id: "tools" as const,
      label: "工具",
      title: "工具链",
      status: toolStatus(),
      description: "工具会被执行层按权限调度，包括文件读取、测绘生产、规范知识和基础执行。",
      target: "#agent-tools",
      action: "查看工具",
    },
    {
      id: "skills" as const,
      label: "流程",
      title: "专业流程",
      status: skillStatus(),
      description: "专业流程是可复用的作业方法，适合沉淀工程测绘流程、审查规则和交付规范。",
      target: "#agent-skills",
      action: "查看流程",
    },
    {
      id: "workflows" as const,
      label: "工作流",
      title: "工作流",
      status: workflowStatus(),
      description: "工作流把多个智能体串起来，适合外业首检、趋势分析、报告生成和审校链路。",
      target: "#agent-workflows",
      action: "查看工作流",
    },
    {
      id: "mcp" as const,
      label: "MCP",
      title: "MCP 连接器",
      status: "按项目启用",
      description: "MCP 让智能体连接专业系统、知识库和外部工具。当前从项目会话和设置中心管理。",
      target: "#agent-tools",
      action: "查看相关工具",
    },
    {
      id: "providers" as const,
      label: "模型",
      title: "模型 Provider",
      status: connectedProviders().length > 0 ? `${connectedProviders().length} 个已接入` : "待接入",
      description: `默认建议 ${recommendedModel}，也可以把审校、平差和资料整理智能体绑定到不同模型。`,
      button: "接入模型",
    },
    {
      id: "harness" as const,
      label: "执行层",
      title: "执行层配置",
      status: "本地安全模式",
      description: "执行层管理模型路由、工具权限、工作区边界和高风险动作确认，是桌面端实际运行核心。",
      target: "/harness",
      action: "查看执行层",
    },
  ])
  const activePackage = createMemo(() => market().find((item) => item.id === activeMarket()) ?? market()[0])
  const routedAgents = createMemo(() => collaborators().slice(0, 8))
  const visibleModelPreview = createMemo(() =>
    visibleModels()
      .slice()
      .sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.name.localeCompare(b.name))
      .slice(0, 6),
  )
  const modelOptions = createMemo(() =>
    visibleModels()
      .slice()
      .sort((a, b) => a.provider.name.localeCompare(b.provider.name) || a.name.localeCompare(b.name))
      .map((model) => ({
        value: `${model.provider.id}/${model.id}`,
        label: `${model.provider.name} / ${model.name}`,
      })),
  )
  const canStart = createMemo(
    () => directory().trim().length > 0 && selectedAgent().trim().length > 0 && draft().trim().length > 0,
  )
  const starters = [
    "检查当前线路复测资料，列出缺失文件并给出下一步计划。",
    "对外业监测数据做首检，标出异常点和复核建议。",
    "根据资料起草监测方案大纲，并列出需要补充的依据。",
  ]

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return items().filter((agent) => {
      const visible =
        mode() === "all" ||
        (mode() === "primary" && agent.mode === "primary") ||
        (mode() === "collaborator" && agent.mode !== "primary")
      const found =
        !needle ||
        agent.name.toLowerCase().includes(needle) ||
        (agent.displayName ?? "").toLowerCase().includes(needle) ||
        (agent.description ?? agent.prompt ?? "").toLowerCase().includes(needle)
      return visible && found
    })
  })

  function projectName(value: string) {
    const clean = value.trim().replaceAll("\\", "/").replace(/\/+$/, "")
    const parts = clean.split("/").filter(Boolean)
    return parts.at(-1) ?? "未选择项目"
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
          title: "选择工作区文件夹",
          multiple: false,
        }),
      )
      return
    }
    dialog.show(
      () => <DialogSelectDirectory title="选择工作区文件夹" onSelect={resolve} />,
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

  const routeValue = (agent: AgentStudioItem) => {
    if (!agent.model) return ""
    return `${agent.model.providerID}/${agent.model.modelID}`
  }

  const routeOptions = (agent: AgentStudioItem) => {
    const current = routeValue(agent)
    if (!current || modelOptions().some((model) => model.value === current)) return modelOptions()
    return [{ value: current, label: `当前绑定 ${current}` }, ...modelOptions()]
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
      setItems((current) =>
        current.map((item) =>
          item.name === agent.name
            ? {
                ...item,
                model: route,
              }
            : item,
        ),
      )
      setError("")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      updateRouteSaving(agent.name, false)
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
    setSessionHandoff(target.key, { agent: target.agent, prompt: target.prompt })
    navigate(target.href)
  }

  createEffect(() => {
    if (manualDirectory() || directory()) return
    const current = server.projects.last() ?? recent()[0]?.worktree
    if (current) setDirectory(current)
  })

  createEffect(() => {
    const current = selectedAgent()
    if (items().some((agent) => agent.name === current)) return
    const chief = items().find((agent) => agent.name === "chief_manager")
    const first = chief ?? items()[0]
    if (first) setSelectedAgent(first.name)
  })

  return (
    <main class="agent-studio" data-testid="agents-page">
      <section class="agent-command-shell" data-testid="agent-collaboration-start">
        <aside class="agent-command-sidebar">
          <button type="button" class="agent-brand" onClick={() => navigate("/home")}>
            <span class="agent-brand__logo">
              <Icon name="brain" size="small" />
            </span>
            <span>
              <strong>RAILWISE</strong>
              <small>Agent Studio</small>
            </span>
          </button>

          <div class="agent-sidebar-section">
            <div class="agent-sidebar-section__bar">
              <span>能力市场</span>
              <A href="/marketplace">全部</A>
            </div>
            <nav class="agent-market-tabs" aria-label="能力市场分类" data-testid="agent-marketplace">
              <For each={market()}>
                {(item) => (
                  <button
                    type="button"
                    classList={{ active: activeMarket() === item.id }}
                    aria-pressed={activeMarket() === item.id}
                    onClick={() => setActiveMarket(item.id)}
                  >
                    <span>{item.label}</span>
                    <small>{item.status}</small>
                  </button>
                )}
              </For>
            </nav>
          </div>

          <div class="agent-sidebar-section">
            <div class="agent-sidebar-section__bar">
              <span>最近项目</span>
              <button type="button" onClick={chooseDirectory} aria-label="添加项目">
                <Icon name="plus-small" size="small" />
              </button>
            </div>
            <div class="agent-project-list">
              <Show when={recent().length} fallback={<div class="agent-project-empty">选择文件夹后会出现在这里。</div>}>
                <For each={recent()}>
                  {(project) => (
                    <button
                      type="button"
                      classList={{ active: project.worktree === directory() }}
                      onClick={() => updateDirectory(project.worktree)}
                    >
                      <span>
                        <Icon name="folder" size="small" />
                      </span>
                      <strong>{projectName(project.worktree)}</strong>
                      <small>{DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative()}</small>
                    </button>
                  )}
                </For>
              </Show>
            </div>
          </div>
        </aside>

        <section class="agent-command-main">
          <header class="agent-command-topbar">
            <A href="/home" class="agent-pill">
              <Icon name="folder" size="small" />
              工作台
            </A>
            <A href="/harness" class="agent-pill">
              <Icon name="server" size="small" />
              执行层
            </A>
            <button type="button" class="agent-pill" onClick={connectProvider}>
              <Icon name="models" size="small" />
              接入模型
            </button>
          </header>

          <form
            class="agent-composer"
            onSubmit={(event) => {
              event.preventDefault()
              startCollaboration()
            }}
          >
            <div class="agent-composer__title">
              <h1>让 RAILWISE 组织哪项工作？</h1>
            </div>
            <div class="agent-composer__project">
              <span>
                <Icon name="folder" size="small" />
              </span>
              <div>
                <strong>{selectedName()}</strong>
                <small>{selectedMeta()}</small>
              </div>
              <button type="button" class="agent-button agent-button--ghost" onClick={chooseDirectory}>
                选择文件夹
              </button>
            </div>
            <div class="agent-composer__agent">
              <label for="agent-collaboration-agent">协作角色</label>
              <select
                id="agent-collaboration-agent"
                data-testid="agent-collaboration-agent"
                value={selectedAgent()}
                onInput={(event) => setSelectedAgent(event.currentTarget.value)}
              >
                <Show when={collaborators().length} fallback={<option value={selectedAgent()}>{selectedAgent()}</option>}>
                  <For each={collaborators()}>
                    {(agent) => (
                      <option value={agent.name}>
                        {agent.displayName ?? agent.name} · {agentRoleLabel(agent)}
                      </option>
                    )}
                  </For>
                </Show>
              </select>
              <small>{activeAgent()?.description ?? "选择一个智能体作为本次任务入口。"}</small>
            </div>
            <textarea
              data-testid="agent-collaboration-prompt"
              value={draft()}
              onInput={(event) => setDraft(event.currentTarget.value)}
              placeholder="例如：检查当前线路复测资料，列出缺失文件，并生成下一步执行计划。"
            />
            <div class="agent-composer__footer">
              <div class="agent-starters">
                <For each={starters}>
                  {(item) => (
                    <button type="button" onClick={() => setDraft(item)}>
                      {item.split("，")[0]}
                    </button>
                  )}
                </For>
              </div>
              <button type="submit" class="agent-button" data-testid="agent-start-session" disabled={!canStart()}>
                开始协作
              </button>
            </div>
          </form>
        </section>

        <aside class="agent-command-inspector">
          <section class="agent-inspector-card" data-testid="agent-market-panel">
            <div class="agent-inspector-card__bar">
              <span>{activePackage().label}</span>
              <strong>{activePackage().status}</strong>
            </div>
            <h2>{activePackage().title}</h2>
            <p>{activePackage().description}</p>
            <Show
              when={activePackage().button}
              fallback={
                <A href={activePackage().target ?? "/marketplace"} class="agent-button agent-button--ghost">
                  {activePackage().action}
                </A>
              }
            >
              {(label) => (
                <button type="button" class="agent-button agent-button--ghost" onClick={connectProvider}>
                  {label()}
                </button>
              )}
            </Show>
          </section>

          <section class="agent-inspector-card">
            <div class="agent-inspector-card__line">
              <Icon name="server" size="small" />
              <span>执行层</span>
              <i class={`agent-status-dot ${serverDotClass()}`} />
            </div>
            <strong>{serverLabel()}</strong>
            <small>工具权限、文件边界和高风险动作由执行层接管。</small>
          </section>

          <section class="agent-inspector-card">
            <div class="agent-inspector-card__line">
              <Icon name="models" size="small" />
              <span>模型</span>
            </div>
            <strong>{connectedProviders().length > 0 ? `${connectedProviders()[0]?.name} / ${recommendedModel}` : `默认建议 ${recommendedModel}`}</strong>
            <small>{routeSummary().bound} 个专属绑定，{routeSummary().defaulted} 个继承默认。</small>
          </section>

          <section class="agent-inspector-card agent-inspector-card--metrics" aria-busy={loading()}>
            <div>
              <span>智能体</span>
              <strong>{summary().total}</strong>
            </div>
            <div>
              <span>工具</span>
              <strong>{tools().length}</strong>
            </div>
            <div>
              <span>流程</span>
              <strong>{skills().length}</strong>
            </div>
          </section>
        </aside>
      </section>

      <section class="agent-model-routing" data-testid="agent-model-routing">
        <div class="agent-section__header">
          <div>
            <h2>模型接入与智能体路由</h2>
            <p>默认建议 {recommendedModel}；主控、审校、平差等智能体可以分别绑定不同模型。</p>
          </div>
          <button type="button" class="agent-button" onClick={connectProvider}>
            接入模型
          </button>
        </div>

        <div class="agent-model-routing__stats">
          <div>
            <span>已接入 Provider</span>
            <strong>{connectedProviders().length}</strong>
            <small>{setupState() === "needs-provider" ? "建议先接入 DeepSeek 或 OpenRouter" : "可用于模型路由"}</small>
          </div>
          <div>
            <span>可见模型</span>
            <strong>{visibleModels().length}</strong>
            <small>{setupState() === "models-hidden" ? "Provider 已接入，需启用模型" : `默认建议 ${recommendedModel}`}</small>
          </div>
          <div>
            <span>专属绑定</span>
            <strong>{routeSummary().bound}</strong>
            <small>{routeSummary().defaulted} 个智能体继承默认模型</small>
          </div>
        </div>

        <div class="agent-model-routing__body">
          <div class="agent-model-routing__panel">
            <div class="agent-model-routing__bar">
              <span>模型接入</span>
              <small>{setupState() === "ready" ? "已可用" : "待配置"}</small>
            </div>
            <Show
              when={visibleModelPreview().length}
              fallback={
                <div class="agent-model-routing__empty">
                  <strong>还没有可用模型</strong>
                  <small>点击“接入模型”，添加 DeepSeek、OpenRouter 或 OpenAI 兼容模型后即可分配给智能体。</small>
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
              <div class="agent-model-list">
                <For each={visibleModelPreview()}>
                  {(model) => (
                    <div class="agent-model-item">
                      <strong>{model.provider.name}</strong>
                      <span>{model.name}</span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>

          <div class="agent-model-routing__panel">
            <div class="agent-model-routing__bar">
              <span>智能体模型分配</span>
              <small>{routeSummary().total} 个可见智能体</small>
            </div>
            <div class="agent-route-list">
              <For each={routedAgents()}>
                {(agent) => (
                  <div class="agent-route-row">
                    <div>
                      <strong>{agent.displayName ?? agent.name}</strong>
                      <small>{agentRoleLabel(agent)}</small>
                    </div>
                    <div class="agent-route-row__controls">
                      <select
                        aria-label={`设置 ${agent.name} 模型`}
                        value={routeValue(agent)}
                        disabled={routeSaving()[agent.name] || (!modelOptions().length && !routeValue(agent))}
                        onInput={(event) => void saveRoute(agent, event.currentTarget.value)}
                      >
                        <option value="">默认 {recommendedModel}</option>
                        <For each={routeOptions(agent)}>
                          {(model) => <option value={model.value}>{model.label}</option>}
                        </For>
                      </select>
                      <span>{routeSaving()[agent.name] ? "保存中" : modelRouteLabel(agent)}</span>
                      <A href={`/agents/${agent.name}`}>高级</A>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
        </div>
      </section>

      <Show when={featured().length}>
        <section class="agent-rail" aria-label="核心协作链路">
          <For each={featured()}>
            {(agent) => (
              <A href={`/agents/${agent.name}`} class="agent-rail__item">
                <span>{agent.mode === "primary" ? "主控" : "协作"}</span>
                <strong>{agent.displayName ?? agent.name}</strong>
                <small>{agent.description ?? "参与多智能体生产链路"}</small>
              </A>
            )}
          </For>
        </section>
      </Show>

      <section class="agent-toolbar" id="agent-library">
        <div>
          <h2>智能体库</h2>
          <p>查看可用智能体并进入配置；真正协作从首页或上方对话框发起。</p>
        </div>
        <div class="agent-toolbar__controls">
          <input
            value={query()}
            onInput={(event) => setQuery(event.currentTarget.value)}
            placeholder="搜索智能体"
            aria-label="搜索智能体"
          />
          <select value={mode()} onInput={(event) => setMode(event.currentTarget.value as ModeFilter)}>
            <For each={modes}>{(item) => <option value={item.value}>{item.label}</option>}</For>
          </select>
        </div>
      </section>

      <Show when={error()}>
        <p class="agent-error">{error()}</p>
      </Show>

      <section class="agent-grid" aria-busy={loading()}>
        <For each={filtered()}>
          {(agent) => <AgentCard agent={agent} />}
        </For>
      </section>

      <Show when={!loading() && filtered().length === 0}>
        <div class="agent-empty">未找到匹配的智能体。</div>
      </Show>

      <section class="agent-inventory">
        <div class="agent-inventory__column" id="agent-tools">
          <div class="agent-section__header">
            <div>
              <h2>工具链</h2>
              <p>这些工具会在智能体执行任务时被调度，不再藏在命令行里。</p>
            </div>
          </div>
          <div class="agent-tool-groups">
            <For each={grouped()}>
              {(group) => (
                <div class="agent-tool-group">
                  <div class="agent-tool-group__bar">
                    <span>{group.label}</span>
                    <small>{group.items.length}</small>
                  </div>
                  <div class="agent-tool-list">
                    <For each={group.items}>
                      {(tool) => (
                        <span class="agent-chip" title={tool.id}>
                          {tool.label}
                        </span>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </For>
          </div>
        </div>
        <div class="agent-inventory__column" id="agent-skills">
          <div class="agent-section__header">
            <div>
              <h2>专业流程</h2>
              <p>按任务加载作业流程、审核方法和工具使用规范。</p>
            </div>
          </div>
          <div class="agent-skill-list">
            <For each={visibleSkills()}>
              {(skill) => (
                <div class="agent-skill" title={skill.location}>
                  <strong>{skill.name}</strong>
                  <small>{skill.description}</small>
                </div>
              )}
            </For>
            <Show when={!skills().length && !loading()}>
              <div class="agent-empty">当前未发现专业流程。</div>
            </Show>
          </div>
        </div>
      </section>

      <div id="agent-workflows">
        <WorkflowGallery />
      </div>
    </main>
  )
}
