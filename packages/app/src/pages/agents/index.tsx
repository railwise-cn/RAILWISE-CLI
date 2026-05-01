import "./agent-studio.css"
import { createMemo, createSignal, For, onMount, Show } from "solid-js"
import { AgentCard } from "@/components/agent-card"
import { WorkflowGallery } from "@/components/workflow-gallery"
import { useAgentUpdates } from "@/hooks/use-agent-updates"
import type { AgentMode, AgentStudioItem } from "@/types/agent-studio"
import { useAgentStudioApi } from "./api"

const modes = [
  { value: "all", label: "全部" },
  { value: "primary", label: "主智能体" },
  { value: "subagent", label: "子智能体" },
] as const
type ModeFilter = (typeof modes)[number]["value"]

export default function AgentsPage() {
  const api = useAgentStudioApi()
  const [items, setItems] = createSignal<AgentStudioItem[]>([])
  const [query, setQuery] = createSignal("")
  const [mode, setMode] = createSignal<ModeFilter>("all")
  const [loading, setLoading] = createSignal(true)
  const [error, setError] = createSignal("")

  function load() {
    setLoading(true)
    void api
      .list()
      .then((agents) => {
        setItems(agents)
        setError("")
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  onMount(load)
  useAgentUpdates(load)

  const filtered = createMemo(() => {
    const needle = query().trim().toLowerCase()
    return items().filter((agent) => {
      const visible = mode() === "all" || agent.mode === (mode() as AgentMode)
      const found =
        !needle ||
        agent.name.toLowerCase().includes(needle) ||
        (agent.description ?? agent.prompt ?? "").toLowerCase().includes(needle)
      return visible && found
    })
  })

  return (
    <main class="agent-studio" data-testid="agents-page">
      <section class="agent-toolbar">
        <div>
          <h1>智能体工作台</h1>
          <p>{items().length} 个智能体，覆盖规划、研究、写作、审校与工程执行。</p>
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

      <WorkflowGallery />
    </main>
  )
}
