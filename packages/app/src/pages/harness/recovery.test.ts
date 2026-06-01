import { describe, expect, test } from "bun:test"
import type { ToolPart } from "@railwise/sdk/v2/client"
import { repairInstruction, toolInputPreview, toolRecovery, toolTitle } from "./recovery"

function part(error: string, input: Record<string, unknown> = {}, tool = "bash"): ToolPart {
  return {
    id: "part",
    sessionID: "session",
    messageID: "message",
    type: "tool",
    callID: "call",
    tool,
    state: {
      status: "error",
      input,
      error,
      time: {
        start: 1,
        end: 2,
      },
    },
  }
}

describe("toolRecovery", () => {
  test("classifies permission failures first", () => {
    expect(toolRecovery(part("Operation not permitted while writing outside workspace")).kind).toBe("permission")
  })

  test("classifies model and provider failures", () => {
    expect(toolRecovery(part("HTTP 401 invalid credentials for provider deepseek")).kind).toBe("model")
  })

  test("classifies missing workspace files", () => {
    expect(toolRecovery(part("ENOENT: no such file or directory", { path: "/missing/report.md" })).kind).toBe("workspace")
  })

  test("classifies network failures", () => {
    expect(toolRecovery(part("Health check timed out for http://127.0.0.1:3000")).kind).toBe("network")
  })

  test("classifies tool schema failures", () => {
    expect(toolRecovery(part("Invalid input: expected boolean, received array")).kind).toBe("tool")
  })
})

describe("repairInstruction", () => {
  test("includes recovery label, tool title, input preview and error", () => {
    const text = repairInstruction(part("Invalid input: expected boolean", { tools: { survey: ["bad"] } }, "config"))

    expect(text).toContain("失败类型：工具参数")
    expect(text).toContain("工具：config")
    expect(text).toContain("标题：config")
    expect(text).toContain("输入摘要：")
    expect(text).toContain("错误信息：Invalid input")
  })

  test("uses completed title when present", () => {
    expect(
      toolTitle({
        ...part("unused"),
        state: {
          status: "completed",
          input: {},
          output: "",
          title: "读取报告",
          metadata: {},
          time: { start: 1, end: 2 },
        },
      }),
    ).toBe("读取报告")
  })

  test("truncates long input previews", () => {
    expect(toolInputPreview("a".repeat(140))).toHaveLength(120)
  })
})
