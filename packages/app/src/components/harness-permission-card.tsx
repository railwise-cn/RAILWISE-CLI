import type { HarnessEvent } from "./harness-timeline"
import { harnessRiskLabel } from "./harness-timeline-state"

export function HarnessPermissionCard(props: {
  event?: HarnessEvent
  onApprove?: () => void
  onReject?: () => void
}) {
  return (
    <section class="harness-permission">
      <div>
        <span>权限门禁</span>
        <h2>{props.event?.title ?? "当前没有危险权限请求"}</h2>
        <p>{props.event?.detail ?? "涉及写文件、执行命令、访问外部目录等操作时，RAILWISE 会在这里等待确认。"}</p>
      </div>
      <div class="harness-permission__footer">
        <span>{harnessRiskLabel(props.event?.risk)}</span>
        <button type="button" disabled={!props.event} onClick={props.onReject}>
          拒绝
        </button>
        <button type="button" disabled={!props.event} onClick={props.onApprove}>
          允许
        </button>
      </div>
    </section>
  )
}
