import { A } from "@solidjs/router"
import { PROJECT_TYPE_LABEL, type ProjectCard as Card } from "./types"

const status = {
  active: ["运行中", "var(--success)"],
  completed: ["已完成", "var(--info)"],
  paused: ["已暂停", "var(--warning)"],
  error: ["异常", "var(--error)"],
} as const

export function ProjectCard(props: { card: Card }) {
  const card = () => props.card
  const state = () => status[card().status]

  return (
    <A href={`/dashboard?project=${encodeURIComponent(card().id)}`} class="dashboard-project-card" data-status={card().status}>
      <div class="dashboard-project-card__top">
        <span class="dashboard-type-chip">{PROJECT_TYPE_LABEL[card().type]}</span>
        <span class="dashboard-project-card__state" style={{ color: state()[1] }}>
          {state()[0]}
        </span>
      </div>
      <h3>{card().name}</h3>
      <p>{card().description ?? "本地工程项目"}</p>
      <div class="dashboard-progress">
        <span style={{ width: `${card().progress}%`, "background-color": state()[1] }} />
      </div>
      <dl>
        <div>
          <dt>监测点</dt>
          <dd>{card().pointCount}</dd>
        </div>
        <div>
          <dt>告警</dt>
          <dd classList={{ critical: card().alertCount > 0 }}>{card().alertCount}</dd>
        </div>
        <div>
          <dt>最新数据</dt>
          <dd>{new Date(card().lastActivity).toLocaleDateString("zh-CN")}</dd>
        </div>
      </dl>
    </A>
  )
}
