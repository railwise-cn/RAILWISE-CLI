import type { HarnessEvent, HarnessStatus } from "@railwise/sdk/v2"
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js"
import { useSDK } from "@/context/sdk"

const agents: Record<string, string> = {
  chief_manager: "项目总控",
  source_ingestor: "资料入库专员",
  norm_librarian: "规范资料管理员",
  knowledge_curator: "知识库整理员",
  cpiii_specialist: "CPIII 测量专家",
  adjustment_computer: "严密平差计算",
  railway_norm_consultant: "铁路规范顾问",
  technical_writer: "工程报告编制",
  qa_reviewer: "总工办质检",
  data_analyst: "测绘数据分析",
}

function mode(status: HarnessStatus | undefined) {
  if (!status) return "同步中"
  if (status.mode === "auto") return "自动执行"
  if (status.mode === "ask") return "询问确认"
  return "安全确认"
}

function risk(event: HarnessEvent) {
  if (event.risk === "high") return "高风险"
  if (event.risk === "medium") return "需关注"
  return "低风险"
}

export function eventKind(event: HarnessEvent) {
  if (event.type.startsWith("permission.")) return "权限"
  if (event.type.startsWith("tool.")) return "工具"
  if (event.type === "artifact.created" || event.type === "session.completed") return "产物"
  if (event.type === "skill.loaded") return "Skill"
  return "运行"
}

export function eventStatus(event: HarnessEvent) {
  if (event.type === "tool.started") return "进行中"
  if (event.type === "permission.requested") return "待确认"
  if (event.type === "tool.failed") return "失败"
  if (event.type === "permission.resolved") return "已处理"
  if (event.type === "tool.completed" || event.type === "session.completed" || event.type === "artifact.created")
    return "已完成"
  return "已记录"
}

export function visibleEvents(events: HarnessEvent[]) {
  return events
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 8)
}

function detail(event: HarnessEvent) {
  if (event.error) return event.error
  if (event.artifactPath) return event.artifactPath
  if (event.duration !== undefined) return `${event.detail ?? event.capabilityID ?? ""} ${event.duration}ms`.trim()
  return event.detail ?? event.capabilityID
}

function clock(value: number) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function SessionHarnessPanel(props: { sessionID?: string; agent?: string }) {
  const sdk = useSDK()
  const [status, setStatus] = createSignal<HarnessStatus>()
  const [events, setEvents] = createSignal<HarnessEvent[]>([])
  const [error, setError] = createSignal("")

  const recent = createMemo(() => visibleEvents(events()))
  const agent = createMemo(() => (props.agent ? (agents[props.agent] ?? props.agent) : undefined))
  const model = createMemo(() => status()?.model ?? events().findLast((event) => event.type === "model.selected")?.detail)
  const pending = createMemo(() => {
    const count = status()?.pendingPermissionCount
    if (!count) return "无待处理"
    return `${count} 待确认`
  })
  const running = createMemo(() => {
    const count = status()?.runningToolCount
    if (!count) return "空闲"
    return `${count} 运行中`
  })

  createEffect(() => {
    const sessionID = props.sessionID
    sdk.directory
    let disposed = false

    const refresh = async () => {
      try {
        const [next, timeline] = await Promise.all([
          sdk.client.harness.status(),
          sessionID ? sdk.client.harness.timeline({ sessionID }) : Promise.resolve(undefined),
        ])
        if (disposed) return
        if (next.data) setStatus(next.data)
        if (timeline?.data) setEvents(timeline.data)
        setError("")
      } catch (err) {
        if (disposed) return
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    void refresh()
    const timer = window.setInterval(refresh, 5000)
    onCleanup(() => {
      disposed = true
      window.clearInterval(timer)
    })
  })

  return (
    <section data-testid="session-harness-panel" class="shrink-0 border-b border-border-weak-base bg-surface-base">
      <div class="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-11-medium uppercase text-text-muted">RAILWISE Harness</div>
            <div class="truncate text-13-medium text-text-strong">
              {agent() ? `当前入口：${agent()}` : "会话运行时"}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 text-12-regular text-text-weak">
            <span class="rounded-md border border-border-weak-base px-2 py-1">{mode(status())}</span>
            <span class="max-w-56 truncate rounded-md border border-border-weak-base px-2 py-1">
              模型 {model() ?? "未选择"}
            </span>
            <span class="rounded-md border border-border-weak-base px-2 py-1">
              能力 {status()?.capabilityCount ?? "同步中"}
            </span>
            <span class="rounded-md border border-border-weak-base px-2 py-1">权限 {pending()}</span>
            <span class="rounded-md border border-border-weak-base px-2 py-1">工具 {running()}</span>
          </div>
        </div>

        <Show
          when={recent().length > 0}
          fallback={
            <div class="text-12-regular text-text-muted">
              {props.sessionID ? "等待智能体调度工具、权限或交付产物。" : "新会话将在发送第一条任务后写入 Harness 时间线。"}
            </div>
          }
        >
          <ol class="grid gap-1.5">
            <For each={recent()}>
              {(event) => (
                <li class="grid min-w-0 grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-md border border-border-weak-base px-2 py-1.5 text-12-regular">
                  <span class="rounded bg-surface-panel px-1.5 py-0.5 text-11-medium text-text-muted">
                    {eventKind(event)}
                  </span>
                  <span
                    classList={{
                      "text-text-muted": eventStatus(event) !== "失败",
                      "text-text-danger-base": eventStatus(event) === "失败",
                    }}
                  >
                    {eventStatus(event)}
                  </span>
                  <div class="min-w-0">
                    <div class="truncate text-12-medium text-text-strong">{event.title}</div>
                    <Show when={detail(event)}>
                      {(value) => <div class="truncate text-11-regular text-text-weak">{value()}</div>}
                    </Show>
                  </div>
                  <div class="text-right text-11-regular text-text-muted">
                    <div>{clock(event.createdAt)}</div>
                    <div>{risk(event)}</div>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </Show>

        <Show when={error()}>
          <div class="text-12-regular text-text-danger-base">{error()}</div>
        </Show>
      </div>
    </section>
  )
}
