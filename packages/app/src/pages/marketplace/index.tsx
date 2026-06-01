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
import { agentStudioSummary, modelSetupState, recommendedModel, recommendedProviders } from "@/pages/agents/collaboration"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"

const ids = ["agents", "tools", "skills", "workflows", "mcp", "providers", "harness"] as const
type Id = (typeof ids)[number]

function result<T>(value: PromiseSettledResult<T>, fallback: T) {
  if (value.status === "fulfilled") return value.value
  return fallback
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

  const connected = createMemo(() => providers.connected().filter((provider) => provider.id !== "railwise"))
  const visible = createMemo(() => models.list().filter((model) => models.visible({ providerID: model.provider.id, modelID: model.id })))
  const setup = createMemo(() => modelSetupState({ connectedProviders: connected().length, visibleModels: visible().length }))
  const summary = createMemo(() => agentStudioSummary(agents()))
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
      description: "管理主控、审校、平差、资料整理、报告生成等专业智能体。",
      href: "/agents",
      action: "管理智能体",
    },
    {
      id: "tools" as const,
      label: "Tools",
      title: "工具链",
      detail: `${tools().length} 个工具`,
      description: "文件读取、规范检索、测绘生产、报告导出等工具由 Harness 调度。",
      href: "/agents#agent-tools",
      action: "查看工具",
    },
    {
      id: "skills" as const,
      label: "Skills",
      title: "专业流程",
      detail: `${skills().length} 个 Skills`,
      description: "沉淀工程测绘作业方法、审查规则、交付流程和工具使用规范。",
      href: "/agents#agent-skills",
      action: "查看 Skills",
    },
    {
      id: "workflows" as const,
      label: "Workflows",
      title: "工作流",
      detail: `${workflows().length} 个工作流`,
      description: "把多个智能体串成外业首检、监测分析、汇报 PPT 和报告审校链路。",
      href: "/agents#agent-workflows",
      action: "查看工作流",
    },
    {
      id: "mcp" as const,
      label: "MCP",
      title: "MCP 连接器",
      detail: "按项目启用",
      description: "连接知识库、专业系统和外部工具；权限和审计由 Harness 统一接管。",
      href: "/harness",
      action: "查看执行层",
    },
    {
      id: "providers" as const,
      label: "Providers",
      title: "模型 Provider",
      detail: setup() === "ready" ? `${visible().length} 个可见模型` : `默认建议 ${recommendedModel}`,
      description: "接入 DeepSeek、OpenRouter 或 OpenAI 兼容模型，再按智能体分配模型。",
      action: "接入模型",
      button: true,
    },
    {
      id: "harness" as const,
      label: "Harness",
      title: "Harness Profile",
      detail: "工作区 / 权限 / 审计",
      description: "管理本地执行边界、权限确认、工具事件、问题回答和失败恢复。",
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
        </div>
        <div class="agent-market-panel__status">
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
                <span>{item.label}</span>
                <h2>{item.title}</h2>
                <p>{item.description}</p>
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
                  <button type="button" class="agent-button agent-button--ghost" onClick={connectProvider}>
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
