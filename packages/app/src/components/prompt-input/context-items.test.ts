import { describe, expect, test } from "bun:test"

import { contextItemOpenLabel, shouldOpenContextItemKey } from "./context-item-helpers"

describe("PromptContextItems helpers", () => {
  test("opens context items from expected keyboard shortcuts", () => {
    expect(shouldOpenContextItemKey("Enter")).toBe(true)
    expect(shouldOpenContextItemKey(" ")).toBe(true)
    expect(shouldOpenContextItemKey("Escape")).toBe(false)
  })

  test("builds accessible open labels for context files", () => {
    expect(contextItemOpenLabel("打开文件", "成果报告.md")).toBe("打开文件 成果报告.md")
  })
})
