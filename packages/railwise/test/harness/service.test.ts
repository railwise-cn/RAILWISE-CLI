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
      id: "perm_external",
      sessionID: "ses_status",
      type: "permission.requested",
      title: "请求读取外部目录",
      detail: "/tmp/railwise-input",
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

  test("tracks tool lifecycle around async work", async () => {
    Harness.clear("ses_track_tool")
    const result = await Harness.trackTool(
      {
        sessionID: "ses_track_tool",
        callID: "call_tool",
        tool: "tool_wiki_query",
        title: "查询规范库",
        completedTitle: () => "规范库查询完成",
      },
      async () => "ok",
    )

    expect(result).toBe("ok")
    expect(Harness.timeline("ses_track_tool").map((event) => event.type)).toEqual(["tool.started", "tool.completed"])

    await expect(
      Harness.trackTool(
        {
          sessionID: "ses_track_tool",
          callID: "call_tool_error",
          tool: "tool_wiki_query",
          title: "查询规范库",
        },
        async () => {
          throw new Error("wiki unavailable")
        },
      ),
    ).rejects.toThrow("wiki unavailable")

    const timeline = Harness.timeline("ses_track_tool")
    expect(timeline.map((event) => event.type)).toEqual([
      "tool.started",
      "tool.completed",
      "tool.started",
      "tool.failed",
    ])
    expect(timeline[3]?.error).toBe("wiki unavailable")
    expect((await Harness.status({ workspace: "/tmp/railwise-status" })).runningToolCount).toBe(0)
    Harness.clear("ses_track_tool")
  })

  test("records artifacts produced by tracked tools", async () => {
    Harness.clear("ses_track_artifact")
    await Harness.trackTool(
      {
        sessionID: "ses_track_artifact",
        callID: "call_report",
        tool: "tool_report_writer",
        title: "生成交付报告",
        artifacts: (result) => [
          {
            title: result.name,
            path: result.path,
            detail: "复测成果报告",
          },
        ],
      },
      async () => ({
        name: "复测成果报告.docx",
        path: "/tmp/railwise/report.docx",
      }),
    )

    const timeline = Harness.timeline("ses_track_artifact")
    expect(timeline.map((event) => event.type)).toEqual(["tool.started", "tool.completed", "artifact.created"])
    expect(timeline[2]?.title).toBe("复测成果报告.docx")
    expect(timeline[2]?.artifactPath).toBe("/tmp/railwise/report.docx")
    Harness.clear("ses_track_artifact")
  })
})
