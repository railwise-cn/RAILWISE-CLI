import { describe, expect, test } from "bun:test"
import {
  compactPath,
  emptyPrompt,
  primaryActionLabel,
  recentWorkspaces,
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
})
