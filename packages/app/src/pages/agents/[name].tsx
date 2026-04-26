import "./agent-studio.css"
import { useNavigate, useParams } from "@solidjs/router"
import { createMemo, createSignal, onMount, Show } from "solid-js"
import { AgentEditor } from "@/components/agent-editor"
import { AgentPermissionForm } from "@/components/agent-permission-form"
import { AgentPreview } from "@/components/agent-preview"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import type { AgentStudioDetail } from "@/types/agent-studio"
import { modeLabel } from "@/utils/agent-card"
import { shortDescription } from "@/utils/agent-markdown"
import { useAgentStudioApi } from "./api"

export default function AgentDetailPage() {
  const api = useAgentStudioApi()
  const params = useParams()
  const navigate = useNavigate()
  const [agent, setAgent] = createSignal<AgentStudioDetail>()
  const [raw, setRaw] = createSignal("")
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal("")
  const dirty = createMemo(() => !!agent() && raw() !== agent()?.rawMarkdown)

  function load() {
    if (!params.name) return
    setLoading(true)
    void api
      .detail(params.name)
      .then((detail) => {
        setAgent(detail)
        setRaw(detail.rawMarkdown)
        setError("")
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
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

  const title = createMemo(() => agent()?.name ?? params.name)
  const summary = createMemo(() => shortDescription(agent()?.description ?? agent()?.prompt ?? "", 120))

  return (
    <main class="agent-studio agent-detail">
      <section class="agent-detail__bar">
        <button type="button" class="agent-button agent-button--ghost" onClick={() => navigate("/agents")}>
          返回
        </button>
        <div>
          <h1>{title()}</h1>
          <p>
            <Show when={agent()} fallback="加载中">
              {(item) => `${modeLabel(item().mode)} · ${summary() || "暂无描述"}`}
            </Show>
          </p>
        </div>
        <button
          type="button"
          class="agent-button"
          data-testid="save-agent-btn"
          disabled={!dirty() || saving()}
          onClick={save}
        >
          {saving() ? "保存中" : dirty() ? "保存" : "已保存"}
        </button>
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
              <h2>Markdown 配置</h2>
              <span class="agent-panel__link">
                {agent()?.filePath ?? ".railwise/agent"}
              </span>
            </div>
            <AgentEditor value={raw()} onChange={setRaw} />
          </div>

          <div class="agent-panel">
            <div class="agent-panel__header">
              <h2>实时预览</h2>
            </div>
            <AgentPreview markdown={raw()} />
          </div>

          <div class="agent-panel">
            <div class="agent-panel__header">
              <h2>权限与模型</h2>
            </div>
            <AgentPermissionForm markdown={raw()} onChange={setRaw} />
          </div>
        </section>
      </Show>
    </main>
  )
}
