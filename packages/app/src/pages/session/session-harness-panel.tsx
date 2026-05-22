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

  const recent = createMemo(() => events().slice(-3).reverse())
  const agent = createMemo(() => (props.agent ? (agents[props.agent] ?? props.agent) : undefined))
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
      <div class="mx-auto flex max-w-3xl flex-col gap-2 px-4 py-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="min-w-0">
            <div class="text-11-medium uppercase text-text-muted">RAILWISE Harness</div>
            <div class="truncate text-13-medium text-text-strong">
              {agent() ? `当前入口：${agent()}` : "会话运行时"}
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 text-12-regular text-text-weak">
            <span class="rounded-md border border-border-weak-base px-2 py-1">{mode(status())}</span>
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
          <div class="grid gap-1.5 md:grid-cols-3">
            <For each={recent()}>
              {(event) => (
                <div class="min-w-0 rounded-md border border-border-weak-base px-2 py-1.5">
                  <div class="flex items-center justify-between gap-2 text-11-regular text-text-muted">
                    <span>{clock(event.createdAt)}</span>
                    <span>{risk(event)}</span>
                  </div>
                  <div class="truncate text-12-medium text-text-strong">{event.title}</div>
                  <Show when={event.detail}>
                    <div class="truncate text-12-regular text-text-weak">{event.detail}</div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>

        <Show when={error()}>
          <div class="text-12-regular text-text-danger-base">{error()}</div>
        </Show>
      </div>
    </section>
  )
}
