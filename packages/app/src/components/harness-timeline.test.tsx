import { describe, expect, test } from "bun:test"
import {
  formatDuration,
  harnessEventTypeLabel,
  harnessRiskLabel,
  timelineRows,
  type HarnessEvent,
} from "./harness-timeline-state"

describe("HarnessTimeline", () => {
  test("derives event type, risk, duration, artifact, and detail rows", () => {
    const rows = timelineRows([
      {
        id: "evt_1",
        sessionID: "ses_1",
        type: "tool.completed",
        title: "读取测量资料",
        detail: "已检查控制点成果表。",
        createdAt: 1,
        duration: 1200,
        risk: "medium",
        artifactPath: "outputs/checklist.md",
      } satisfies HarnessEvent,
    ])

    expect(rows[0]?.type).toBe("工具完成")
    expect(rows[0]?.risk).toBe("需注意")
    expect(rows[0]?.duration).toBe("1.2s")
    expect(rows[0]?.event.artifactPath).toBe("outputs/checklist.md")
  })

  test("sorts older events first", () => {
    const rows = timelineRows([
      { id: "b", sessionID: "ses_1", type: "tool.started", title: "后", createdAt: 20 },
      { id: "a", sessionID: "ses_1", type: "session.started", title: "前", createdAt: 10 },
    ])

    expect(rows.map((row) => row.event.id)).toEqual(["a", "b"])
  })

  test("maps compact labels for timeline metadata", () => {
    expect(harnessEventTypeLabel("permission.requested")).toBe("权限请求")
    expect(harnessRiskLabel("high")).toBe("高风险")
    expect(formatDuration(420)).toBe("420ms")
  })
})
