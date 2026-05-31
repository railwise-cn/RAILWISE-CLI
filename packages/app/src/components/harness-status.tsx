import type { HarnessStatusResponse } from "@railwise/sdk/v2/client"

const modeLabel: Record<HarnessStatusResponse["mode"], string> = {
  safe: "本地安全模式",
  ask: "执行前询问",
  auto: "自动执行",
}

function countLabel(value: number, unit: string) {
  if (value === 0) return "尚未加载"
  return `${value} ${unit}`
}

export function HarnessStatus(props: { status?: HarnessStatusResponse; loading?: boolean; workspace?: string }) {
  const status = () => props.status
  return (
    <section class="harness-status" aria-busy={props.loading}>
      <h2>Harness 状态</h2>
      <dl>
        <div>
          <dt>模式</dt>
          <dd>{status() ? modeLabel[status()!.mode] : "连接中"}</dd>
        </div>
        <div>
          <dt>模型</dt>
          <dd>{status()?.model ?? "默认 DeepSeek V4"}</dd>
        </div>
        <div>
          <dt>工作区</dt>
          <dd>{props.workspace ?? status()?.workspace ?? "等待选择资料目录"}</dd>
        </div>
        <div>
          <dt>能力</dt>
          <dd>{status() ? countLabel(status()!.capabilityCount, "项已启用") : "读取中"}</dd>
        </div>
        <div>
          <dt>工具</dt>
          <dd>{status()?.runningToolCount ? `${status()!.runningToolCount} 个正在运行` : "当前无运行工具"}</dd>
        </div>
        <div>
          <dt>权限</dt>
          <dd>
            {status()?.pendingPermissionCount
              ? `${status()!.pendingPermissionCount} 个请求等待处理`
              : "当前没有危险权限请求"}
          </dd>
        </div>
      </dl>
    </section>
  )
}
