import "./marketplace.css"
import { A } from "@solidjs/router"
import { createMemo, createResource, createSignal, For, Show } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"
import {
  actionLabel,
  capabilityRisk,
  capabilityRiskLabel,
  filterCapabilities,
  groupCapabilities,
  kinds,
  permissionLabels,
  sourceLabel,
  type Capability,
  type CapabilityKind,
} from "./marketplace-state"

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message
  if (typeof error === "string") return error
  return "能力市场暂时无法连接。"
}

export default function MarketplacePage() {
  const sdk = useGlobalSDK()
  const [query, setQuery] = createSignal("")
  const [kind, setKind] = createSignal<CapabilityKind>("all")
  const [busy, setBusy] = createSignal<Record<string, boolean>>({})
  const [error, setError] = createSignal("")
  const [items, { refetch }] = createResource(() =>
    sdk.client.marketplace.capabilities
      .list()
      .then((result) => {
        setError("")
        return result.data?.data ?? []
      })
      .catch((error) => {
        setError(errorMessage(error))
        return []
      }),
  )

  const filtered = createMemo(() => filterCapabilities(items() ?? [], { query: query(), kind: kind() }))
  const grouped = createMemo(() => groupCapabilities(filtered()))

  const toggle = (item: Capability) => {
    setBusy((state) => ({ ...state, [item.id]: true }))
    const task = item.enabled
      ? sdk.client.marketplace.capabilities.disable({ id: item.id })
      : sdk.client.marketplace.capabilities.enable({ id: item.id })
    task
      .then(() => refetch())
      .catch((error) => setError(errorMessage(error)))
      .finally(() =>
        setBusy((state) => {
          const next = { ...state }
          delete next[item.id]
          return next
        }),
      )
  }

  return (
    <main class="marketplace" data-testid="marketplace-page">
      <header class="marketplace-header">
        <div>
          <span>RAILWISE Marketplace</span>
          <h1>能力市场</h1>
          <p>安装、启用和审查智能体、工具、Skills、工作流、MCP 连接器、模型 Provider 与 Harness 配置。</p>
        </div>
        <nav>
          <A href="/home">返回工作台</A>
          <A href="/harness">Harness</A>
        </nav>
      </header>

      <section class="marketplace-toolbar" aria-label="能力筛选">
        <input
          value={query()}
          onInput={(event) => setQuery(event.currentTarget.value)}
          placeholder="搜索智能体、工具、模型或权限关键词"
        />
        <div class="marketplace-tabs">
          <For each={kinds}>
            {(item) => (
              <button
                type="button"
                classList={{ active: kind() === item.value }}
                onClick={() => setKind(item.value)}
              >
                {item.label}
              </button>
            )}
          </For>
        </div>
      </section>

      <Show when={error()}>
        <p class="marketplace-error">{error()}</p>
      </Show>

      <Show
        when={grouped().length > 0}
        fallback={<p class="marketplace-empty">{items.loading ? "正在加载能力市场。" : "没有匹配的能力。"}</p>}
      >
        <div class="marketplace-groups">
          <For each={grouped()}>
            {(group) => (
              <section class="marketplace-group">
                <h2>{group.label}</h2>
                <div class="marketplace-grid">
                  <For each={group.items}>
                    {(item) => (
                      <article class="marketplace-card" data-risk={capabilityRisk(item)}>
                        <div class="marketplace-card__head">
                          <div>
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                          </div>
                          <button type="button" disabled={busy()[item.id]} onClick={() => toggle(item)}>
                            {busy()[item.id] ? "处理中" : actionLabel(item)}
                          </button>
                        </div>
                        <div class="marketplace-meta">
                          <span>{sourceLabel(item.source)}</span>
                          <span>v{item.version}</span>
                          <span>{item.enabled ? "已启用" : "未启用"}</span>
                          <span>{capabilityRiskLabel(item)}</span>
                        </div>
                        <div class="marketplace-permissions">
                          <For each={permissionLabels(item)}>
                            {(label) => <span>{label}</span>}
                          </For>
                          <Show when={permissionLabels(item).length === 0}>
                            <span>无敏感权限</span>
                          </Show>
                        </div>
                        <Show when={item.tags?.length}>
                          <div class="marketplace-tags">
                            <For each={item.tags}>{(tag) => <span>{tag}</span>}</For>
                          </div>
                        </Show>
                      </article>
                    )}
                  </For>
                </div>
              </section>
            )}
          </For>
        </div>
      </Show>
    </main>
  )
}
