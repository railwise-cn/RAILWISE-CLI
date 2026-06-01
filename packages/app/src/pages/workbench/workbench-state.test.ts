import { describe, expect, test } from "bun:test"
import {
  compactPath,
  emptyPrompt,
  primaryActionLabel,
  recentSessions,
  recentWorkspaces,
  primarySessionID,
  resumeActionLabel,
  runtimeLabel,
  sessionRuntimeLabel,
  sessionTitle,
  shouldShowZeroCounter,
} from "./workbench-state"

describe("workbench state", () => {
  test("uses Chinese empty prompts instead of zero counters", () => {
    expect(emptyPrompt({ hasWorkspace: false })).toContain("选择资料目录")
    expect(shouldShowZeroCounter()).toBe(false)
  })

  test("uses chat-first primary actions", () => {
    expect(primaryActionLabel({ hasWorkspace: false })).toBe("选择资料目录")
    expect(primaryActionLabel({ hasWorkspace: true })).toBe("开始会话")
  })

  test("compacts home directory paths for recent workspaces", () => {
    expect(compactPath({ value: "/Users/me/CODE/demo", home: "/Users/me" })).toBe("~/CODE/demo")
    expect(compactPath({ value: "/tmp/demo", home: "/Users/me" })).toBe("/tmp/demo")
  })

  test("deduplicates and sorts recent workspaces", () => {
    expect(
      recentWorkspaces([
        { worktree: "/tmp/a", time: { created: 1, updated: 10 } },
        { worktree: "/tmp/b", time: { created: 1, updated: 30 } },
        { worktree: "/tmp/a/", time: { created: 1, updated: 20 } },
        { worktree: "/", time: { created: 1, updated: 40 } },
      ]).map((project) => project.worktree),
    ).toEqual(["/tmp/b", "/tmp/a"])
  })

  test("shows recent root sessions without archived or child sessions", () => {
    expect(
      recentSessions([
        { id: "old", title: "旧会话", time: { created: 1 } },
        { id: "child", title: "子会话", parentID: "new", time: { created: 40 } },
        { id: "archived", title: "归档", time: { created: 50, archived: 60 } },
        { id: "new", title: "最新会话", time: { created: 10, updated: 70 } },
      ]).map((session) => session.id),
    ).toEqual(["new", "old"])
  })

  test("falls back to a concise session title", () => {
    expect(sessionTitle({ title: "  " })).toBe("未命名会话")
  })

  test("summarizes runtime status for the resume card", () => {
    expect(runtimeLabel({ pendingPermissionCount: 2, runningToolCount: 1 })).toBe("2 个权限等待确认")
    expect(runtimeLabel({ runningToolCount: 3 })).toBe("3 个工具正在运行")
    expect(runtimeLabel({})).toBe("可继续协作")
  })

  test("points the resume action at pending permissions", () => {
    expect(resumeActionLabel({ pendingPermissionCount: 1 })).toBe("处理权限")
    expect(resumeActionLabel({ runningToolCount: 1 })).toBe("继续会话")
    expect(resumeActionLabel({})).toBe("继续会话")
  })

  test("prefers the pending permission session for the primary resume target", () => {
    expect(primarySessionID({ latestID: "new", runtime: { pendingSessionID: "blocked" } })).toBe("blocked")
    expect(primarySessionID({ latestID: "new", runtime: {} })).toBe("new")
  })

  test("only marks the latest session with live runtime status", () => {
    expect(
      sessionRuntimeLabel({
        sessionID: "new",
        latestID: "new",
        runtime: { runningToolCount: 1 },
      }),
    ).toBe("1 个工具正在运行")
    expect(sessionRuntimeLabel({ sessionID: "old", latestID: "new", runtime: { runningToolCount: 1 } })).toBe("已保存")
    expect(
      sessionRuntimeLabel({
        sessionID: "old",
        latestID: "new",
        runtime: { pendingPermissionCount: 1, pendingSessionID: "old" },
      }),
    ).toBe("1 个权限等待确认")
  })
})
