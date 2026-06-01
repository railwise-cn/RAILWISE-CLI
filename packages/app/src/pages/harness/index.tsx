import "./harness.css"
import { A, useSearchParams } from "@solidjs/router"
import { createMemo, createResource } from "solid-js"
import { HarnessPermissionCard } from "@/components/harness-permission-card"
import { HarnessStatus } from "@/components/harness-status"
import { HarnessTimeline, type HarnessEvent } from "@/components/harness-timeline"
import { useGlobalSDK } from "@/context/global-sdk"

export default function HarnessPage() {
  const sdk = useGlobalSDK()
  const [params] = useSearchParams()
  const query = (value: string | string[] | undefined) => (Array.isArray(value) ? (value[0] ?? "") : (value ?? ""))
  const sessionID = createMemo(() => query(params.sessionID) || query(params.session))
  const [status, statusAction] = createResource(() =>
    sdk.client.harness
      .status()
      .then((result) => result.data)
      .catch(() => undefined),
  )
  const [timeline, timelineAction] = createResource(sessionID, (id) =>
    id
      ? sdk.client.harness.session
          .timeline({ sessionID: id })
          .then((result) => result.data)
          .catch(() => undefined)
      : undefined,
  )
  const events = createMemo<HarnessEvent[]>(() => timeline()?.data ?? [])
  const permission = createMemo(() => events().find((event) => event.type === "permission.requested"))
  const permissionID = (event?: HarnessEvent) => event?.id.match(/^harness:(.+):requested$/)?.[1]
  const reply = async (value: "once" | "reject") => {
    const id = permissionID(permission())
    if (!id) return
    await sdk.client.permission.reply({ requestID: id, reply: value }).catch(() => undefined)
    void statusAction.refetch()
    void timelineAction.refetch()
  }

  return (
    <main class="harness-page" data-testid="harness-page">
      <header class="harness-page__header">
        <div>
          <span>RAILWISE Harness</span>
          <h1>运行时控制台</h1>
          <p>查看会话规划、智能体路由、工具调用、产物生成和权限门禁状态。</p>
        </div>
        <nav>
          <A href="/home">返回工作台</A>
          <A href="/marketplace">能力市场</A>
        </nav>
      </header>

      <section class="harness-page__grid">
        <HarnessStatus status={status()} loading={status.loading} />
        <HarnessPermissionCard event={permission()} onApprove={() => reply("once")} onReject={() => reply("reject")} />
      </section>

      <HarnessTimeline
        events={events()}
        empty={
          sessionID()
            ? "这个会话还没有可展示的 Harness 事件。"
            : "打开资料目录并开始会话后，从会话入口进入这里会显示实时运行轨迹。"
        }
      />
    </main>
  )
}
