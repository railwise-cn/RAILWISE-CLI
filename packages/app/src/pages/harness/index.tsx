import "./harness.css"
import { A } from "@solidjs/router"
import { createMemo, createResource } from "solid-js"
import { HarnessPermissionCard } from "@/components/harness-permission-card"
import { HarnessStatus } from "@/components/harness-status"
import { HarnessTimeline, type HarnessEvent } from "@/components/harness-timeline"
import { useGlobalSDK } from "@/context/global-sdk"

export default function HarnessPage() {
  const sdk = useGlobalSDK()
  const [status] = createResource(() => sdk.client.harness.status().then((result) => result.data).catch(() => undefined))
  const events = createMemo<HarnessEvent[]>(() => [])

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
        <HarnessPermissionCard event={events().find((event) => event.type === "permission.requested")} />
      </section>

      <HarnessTimeline events={events()} empty="打开资料目录并开始会话后，这里会显示 Harness 的实时运行轨迹。" />
    </main>
  )
}
