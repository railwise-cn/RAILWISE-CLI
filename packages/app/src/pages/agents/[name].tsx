import "./agent-studio.css"
import { A, useNavigate, useParams } from "@solidjs/router"
import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { AgentEditor } from "@/components/agent-editor"
import { AgentPermissionForm } from "@/components/agent-permission-form"
import { AgentPreview } from "@/components/agent-preview"
import { useGlobalSDK } from "@/context/global-sdk"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import type { AgentStudioDetail } from "@/types/agent-studio"
import { modeLabel } from "@/utils/agent-card"
import { shortDescription } from "@/utils/agent-markdown"
import { Icon, type IconProps } from "@railwise/ui/icon"
import type { CapabilityManifest } from "@railwise/sdk/v2/client"
import { useAgentStudioApi } from "./api"
import { agentDescription, agentDisplayName } from "@/utils/agent-display"
import {
  capabilitiesForAgent,
  capabilityBindings,
  normalizeCapabilities,
  permissionSummary,
  riskLabel,
} from "@/pages/marketplace/marketplace-state"

const labels: Record<CapabilityManifest["kind"], string> = {
  agent: "智能体",
  tool: "工具",
  skill: "技能",
  workflow: "工作流",
  mcp: "MCP",
  provider: "模型",
  harness_profile: "执行层",
}

const icons: Record<CapabilityManifest["kind"], IconProps["name"]> = {
  agent: "brain",
  tool: "checklist",
  skill: "bullet-list",
  workflow: "branch",
  mcp: "mcp",
  provider: "providers",
  harness_profile: "server",
}

export default function AgentDetailPage() {
  const api = useAgentStudioApi()
  const sdk = useGlobalSDK()
  const params = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = createSignal<AgentStudioDetail>()
  const [capabilities, setCapabilities] = createSignal<CapabilityManifest[]>([])
  const [raw, setRaw] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal("")
  const dirty = createMemo(() => !!agent() && raw() !== agent()?.rawMarkdown)

  function load() {
    if (!params.name) return
    setLoading(true)
    void Promise.allSettled([api.detail(params.name), sdk.client.marketplace.capabilities.list()])
      .then(([detail, registry]) => {
        if (detail.status === "fulfilled") {
          setAgent(detail.value)
          setRaw(detail.value.rawMarkdown)
          setError("")
        } else {
          setError(detail.reason instanceof Error ? detail.reason.message : String(detail.reason))
        }
        if (registry.status === "fulfilled") {
          setCapabilities(normalizeCapabilities(registry.value))
          return
        }
        setCapabilities([])
      })
      .finally(() => setLoading(false))
  }

  function save() {
    if (!agent() || !params.name) return
    setSaving(true)
    void api
      .update(params.name, raw())
      .then(() => {
        setAgent((current) => (current ? { ...current, rawMarkdown: raw() } : current))
        setError("")
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setSaving(false))
  }

  onMount(load)
  useAgentUpdates((name) => {
    if (name === params.name) load()
  })

  const title = createMemo(() => agentDisplayName(agent() ?? params.name))
  const summary = createMemo(() => shortDescription(agentDescription(agent()) || "", 120))
  const routed = createMemo(() => capabilitiesForAgent(capabilities(), agent()).slice(0, 6))
  const source = createMemo(() => {
    const value = agent()?.filePath
    if (!value) return "内置"
    const clean = value.trim().replaceAll("\\", "/").replace(/\/+$/, "")
    return clean.split("/").filter(Boolean).at(-1) ?? "本地能力文件"
  })

  return (
    <main class="agent-studio agent-detail" data-testid="agent-detail-page">
      <section class="agent-detail__bar" data-testid="agent-detail-shell">
        <button type="button" class="agent-button agent-button--ghost" onClick={() => navigate("/agents")}>
          返回智能体
        </button>
        <div>
          <span class="agent-kicker">智能体配置</span>
          <h1>{title()}</h1>
          <p>
            <Show when={agent()} fallback="加载中">
              {(item) => `${modeLabel(item().mode)} · ${summary() || "暂无描述"}`}
            </Show>
          </p>
          <div class="agent-detail__meta">
            <span>
              <Icon name="brain" size="small" />
              {title()}
            </span>
            <span title={agent()?.filePath ?? ""}>
              <Icon name="folder" size="small" />
              {source()}
            </span>
          </div>
        </div>
        <div class="agent-detail__actions">
          <A href="/marketplace" class="agent-button agent-button--ghost">
            能力市场
          </A>
          <button
            type="button"
            class="agent-button"
            data-testid="save-agent-btn"
            disabled={!dirty() || saving()}
            onClick={save}
          >
            {saving() ? "保存中" : dirty() ? "保存" : "已保存"}
          </button>
        </div>
      </section>

      <Show when={error()}>
        <p class="agent-error">{error()}</p>
      </Show>

      <Show
        when={!loading() && agent()}
        fallback={<div class="agent-empty">正在读取智能体配置。</div>}
      >
        <section class="agent-detail__grid">
          <div class="agent-panel agent-panel--editor">
            <div class="agent-panel__header">
              <h2>能力定义</h2>
              <span class="agent-panel__link">
                {source()}
              </span>
            </div>
            <AgentEditor value={raw()} onChange={setRaw} />
          </div>

          <div class="agent-panel">
            <div class="agent-panel__header">
              <h2>预览</h2>
            </div>
            <AgentPreview markdown={raw()} />
          </div>

          <div class="agent-detail__side">
            <div class="agent-panel">
              <div class="agent-panel__header">
                <h2>权限与模型</h2>
              </div>
              <AgentPermissionForm markdown={raw()} onChange={setRaw} />
            </div>

            <div class="agent-panel agent-capability-panel" data-testid="agent-capability-routing">
              <div class="agent-panel__header">
                <h2>可调用能力</h2>
                <A href="/marketplace" class="agent-panel__link">
                  能力市场
                </A>
              </div>
              <div class="agent-capability-list">
                <For each={routed()}>
                  {(item) => {
                    const links = capabilityBindings(item)
                    return (
                      <A href="/marketplace" class="agent-capability-row" data-testid="agent-capability-row">
                        <span class="agent-capability-row__icon">
                          <Icon name={icons[item.kind]} size="small" />
                        </span>
                        <span class="agent-capability-row__body">
                          <strong>{item.name}</strong>
                          <small>{labels[item.kind]} · {riskLabel(item.permissions)} · {permissionSummary(item.permissions)}</small>
                          <Show when={links.workflows.length > 0}>
                            <span class="agent-capability-row__chips">
                              <For each={links.workflows.slice(0, 2)}>{(workflow) => <em>{workflow}</em>}</For>
                            </span>
                          </Show>
                        </span>
                      </A>
                    )
                  }}
                </For>
                <Show when={!routed().length}>
                  <div class="agent-capability-empty">
                    <strong>还没有可调用能力</strong>
                    <span>到能力市场启用技能、工具或工作流后会显示在这里。</span>
                  </div>
                </Show>
              </div>
            </div>
          </div>
        </section>
      </Show>
    </main>
  )
}
