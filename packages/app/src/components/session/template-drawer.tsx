import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { agentDisplayName } from "@/utils/agent-display"
import { createEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import "./template-drawer.css"

type Category = "report" | "bid" | "data" | "ppt"
type Variable = {
  key: string
  label: string
  type: "text" | "number" | "date" | "select" | "mileage"
  placeholder?: string
  required?: boolean
  options?: string[]
}

export type RailwiseTemplate = {
  id: string
  name: string
  category: Category
  description: string
  agent: string
  prompt: string
  variables?: Variable[]
  version?: string
}

const categories: Category[] = ["report", "bid", "data", "ppt"]
const labels: Record<Category, string> = {
  report: "报告",
  bid: "标书",
  data: "数据",
  ppt: "PPT",
}

function agentStyle(agent: string) {
  const hue = Array.from(agent).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 48
  return {
    "background-color": `hsla(${32 + hue}, 43%, 40%, 0.1)`,
    color: "var(--rw-text-secondary)",
  }
}

export function renderTemplatePrompt(template: RailwiseTemplate, values: Record<string, string>) {
  return template.prompt.replace(/\{\{(.+?)\}\}/g, (_, key: string) => {
    const name = key.trim()
    return values[name]?.trim() || `[${name}]`
  })
}

export function useTemplateDrawerShortcut(open: () => void) {
  const handler = (event: KeyboardEvent) => {
    if (!(event.metaKey || event.ctrlKey)) return
    if (event.key.toLowerCase() !== "t") return
    event.preventDefault()
    open()
  }

  onMount(() => document.addEventListener("keydown", handler))
  onCleanup(() => document.removeEventListener("keydown", handler))
}

export function TemplateDrawer(props: {
  open: boolean
  directory?: string
  onClose: () => void
  onSend: (input: { agent: string; prompt: string; template: RailwiseTemplate }) => void
}) {
  const server = useServer()
  const platform = usePlatform()
  const [templates, setTemplates] = createSignal<RailwiseTemplate[]>([])
  const [category, setCategory] = createSignal<Category>("report")
  const [selected, setSelected] = createSignal<RailwiseTemplate>()
  const [loading, setLoading] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [values, setValues] = createStore<Record<string, string>>({})

  async function load() {
    const current = server.current
    if (!current) return

    setLoading(true)
    setError(undefined)

    const headers = new Headers()
    if (props.directory) headers.set("x-railwise-directory", props.directory)
    if (current.http.username && current.http.password) {
      headers.set("Authorization", `Basic ${btoa(`${current.http.username}:${current.http.password}`)}`)
    }

    const response = await (platform.fetch ?? fetch)(`${current.http.url}/templates/list`, { headers })
    if (!response.ok) {
      setError(`模板加载失败：${response.status}`)
      setTemplates([])
      setLoading(false)
      return
    }

    setTemplates((await response.json()) as RailwiseTemplate[])
    setLoading(false)
  }

  createEffect(() => {
    if (!props.open) return
    void load()
  })

  createEffect(() => {
    category()
    setSelected(undefined)
  })

  const filtered = () => templates().filter((template) => template.category === category())
  const valid = () => {
    const template = selected()
    if (!template) return false
    return (template.variables ?? [])
      .filter((item) => item.required !== false)
      .every((item) => !!values[item.key]?.trim())
  }

  function submit() {
    const template = selected()
    if (!template) return
    if (!valid()) return

    props.onSend({
      agent: template.agent,
      prompt: renderTemplatePrompt(template, values),
      template,
    })
    props.onClose()
  }

  return (
    <Show when={props.open}>
      <div class="template-drawer-backdrop" onClick={props.onClose} />
      <aside class="template-drawer" data-testid="template-drawer" data-prevent-autofocus>
        <header class="template-drawer-header">
          <strong>任务模板</strong>
          <button type="button" onClick={props.onClose} aria-label="关闭任务模板">
            ×
          </button>
        </header>

        <nav class="template-drawer-tabs" aria-label="模板分类">
          <For each={categories}>
            {(item) => (
              <button
                type="button"
                data-testid={`category-tab-${item}`}
                data-active={category() === item}
                onClick={() => setCategory(item)}
              >
                {labels[item]}
              </button>
            )}
          </For>
        </nav>

        <main class="template-drawer-body">
          <Show
            when={selected()}
            fallback={
              <div class="template-list">
                <Show when={!loading()} fallback={<p class="template-empty">加载模板中...</p>}>
                  <Show when={!error()} fallback={<p class="template-empty">{error()}</p>}>
                    <For each={filtered()} fallback={<p class="template-empty">暂无模板。</p>}>
                      {(template) => (
                        <button
                          type="button"
                          class="template-card"
                          data-testid={`template-card-${template.id}`}
                          onClick={() => setSelected(template)}
                        >
                          <strong>{template.name}</strong>
                          <span>{template.description}</span>
                          <em style={agentStyle(template.agent)}>{agentDisplayName(template.agent)}</em>
                        </button>
                      )}
                    </For>
                  </Show>
                </Show>
              </div>
            }
          >
            {(template) => (
              <section class="template-detail">
                <button type="button" class="template-back" onClick={() => setSelected(undefined)}>
                  ← 返回列表
                </button>
                <div class="template-detail-title">
                  <strong>{template().name}</strong>
                  <span>{template().description}</span>
                  <em style={agentStyle(template().agent)}>{agentDisplayName(template().agent)}</em>
                </div>

                <For each={template().variables ?? []}>
                  {(item) => (
                    <label class="template-field">
                      <span>
                        {item.label}
                        <Show when={item.required !== false}>
                          <b>*</b>
                        </Show>
                      </span>
                      <Show
                        when={item.type === "select"}
                        fallback={
                          <input
                            data-testid={`var-input-${item.key}`}
                            value={values[item.key] ?? ""}
                            type={item.type === "number" || item.type === "mileage" ? "number" : item.type}
                            placeholder={item.placeholder}
                            onInput={(event) => setValues(item.key, event.currentTarget.value)}
                          />
                        }
                      >
                        <select
                          data-testid={`var-select-${item.key}`}
                          value={values[item.key] ?? ""}
                          onChange={(event) => setValues(item.key, event.currentTarget.value)}
                        >
                          <option value="">请选择...</option>
                          <For each={item.options ?? []}>
                            {(option) => <option value={option}>{option}</option>}
                          </For>
                        </select>
                      </Show>
                    </label>
                  )}
                </For>
              </section>
            )}
          </Show>
        </main>

        <Show when={selected()}>
          {(template) => (
            <footer class="template-drawer-footer">
              <button type="button" data-testid="template-send-btn" disabled={!valid()} onClick={submit}>
                填入对话
              </button>
            </footer>
          )}
        </Show>
      </aside>
    </Show>
  )
}
