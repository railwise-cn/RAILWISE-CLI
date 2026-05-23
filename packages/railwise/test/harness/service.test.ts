import { describe, expect, test } from "bun:test"
import { Harness } from "../../src/harness"

describe("Harness service", () => {
  test("returns enabled built-in capabilities in safe mode", async () => {
    const status = await Harness.status({ workspace: "/tmp/railwise" })

    expect(status.mode).toBe("safe")
    expect(status.workspace).toBe("/tmp/railwise")
    expect(status.capabilityCount).toBeGreaterThan(0)
  })

  test("records and clears timeline events by session", () => {
    Harness.clear("ses_test")
    Harness.record({
      id: "evt_test",
      sessionID: "ses_test",
      type: "plan.created",
      title: "生成执行计划",
      createdAt: 1779498000000,
      risk: "low",
    })

    expect(Harness.timeline("ses_test")).toHaveLength(1)
    Harness.clear("ses_test")
    expect(Harness.timeline("ses_test")).toHaveLength(0)
  })

  test("derives active permission and tool counts from timeline events", async () => {
    Harness.clear("ses_status")
    Harness.record({
      id: "evt_permission_request",
      sessionID: "ses_status",
      type: "permission.requested",
      title: "请求读取外部目录",
      detail: "perm_external",
      createdAt: 1779498000000,
      risk: "medium",
    })
    Harness.record({
      id: "evt_tool_start",
      sessionID: "ses_status",
      type: "tool.started",
      title: "运行平差计算",
      createdAt: 1779498000001,
      risk: "low",
      capabilityID: "railwise.tool.adjustment_indirect",
    })

    const active = await Harness.status({ workspace: "/tmp/railwise-status" })

    expect(active.pendingPermissionCount).toBe(1)
    expect(active.runningToolCount).toBe(1)

    Harness.record({
      id: "evt_permission_resolved",
      sessionID: "ses_status",
      type: "permission.resolved",
      title: "已允许权限请求",
      detail: "perm_external",
      createdAt: 1779498000002,
      risk: "medium",
    })
    Harness.record({
      id: "evt_tool_completed",
      sessionID: "ses_status",
      type: "tool.completed",
      title: "平差计算完成",
      createdAt: 1779498000003,
      risk: "low",
      capabilityID: "railwise.tool.adjustment_indirect",
    })

    const settled = await Harness.status({ workspace: "/tmp/railwise-status" })

    expect(settled.pendingPermissionCount).toBe(0)
    expect(settled.runningToolCount).toBe(0)
    Harness.clear("ses_status")
  })
})
