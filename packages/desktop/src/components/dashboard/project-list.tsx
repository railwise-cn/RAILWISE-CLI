import { createMemo, createSignal, For, Show } from "solid-js"
import { PROJECT_TYPE_LABEL, type ProjectCard } from "./types"

const order = ["metro", "excavation", "bridge", "slope", "highrise"] as const

export function ProjectList(props: { projects: ProjectCard[]; loading: boolean }) {
  const [query, setQuery] = createSignal("")
  const filtered = createMemo(() => {
    const value = query().trim().toLowerCase()
    if (!value) return props.projects
    return props.projects.filter((project) => `${project.name} ${project.description ?? ""}`.toLowerCase().includes(value))
  })

  return (
    <section class="dashboard-list" data-testid="dashboard-project-list">
      <div class="dashboard-list__brand">
        <span>RAILWISE</span>
        <strong>睿威智测</strong>
      </div>
      <label class="dashboard-search">
        <span>搜索过滤</span>
        <input value={query()} onInput={(event) => setQuery(event.currentTarget.value)} placeholder="项目名 / 类型" />
      </label>
      <Show when={!props.loading} fallback={<p class="dashboard-muted">正在加载项目索引</p>}>
        <For each={order}>
          {(type) => {
            const items = createMemo(() => filtered().filter((project) => project.type === type))
            return (
              <button class="dashboard-type" type="button">
                <span>{PROJECT_TYPE_LABEL[type]}</span>
                <strong>{items().length} 项目</strong>
              </button>
            )
          }}
        </For>
        <div class="dashboard-list__total">
          <span>监测点总数</span>
          <strong>{filtered().reduce((sum, project) => sum + project.pointCount, 0)}</strong>
        </div>
      </Show>
    </section>
  )
}
