import { describe, expect, test } from "bun:test"
import { agentDisplayName, agentInitial } from "./agent-display"

describe("agentDisplayName", () => {
  test("uses product-facing names for builtin agents", () => {
    expect(agentDisplayName("chief_manager")).toBe("RAILWISE")
    expect(agentDisplayName("qa_inspector")).toBe("数据质检")
    expect(agentDisplayName("ppt_master")).toBe("汇报生成")
  })

  test("lets configured displayName override builtin fallbacks", () => {
    expect(agentDisplayName({ name: "chief_manager", displayName: "项目总控" })).toBe("项目总控")
  })

  test("keeps custom agent ids readable when no display name is configured", () => {
    expect(agentDisplayName("survey_reviewer")).toBe("survey reviewer")
  })
})

describe("agentInitial", () => {
  test("uses the display label for avatar initials", () => {
    expect(agentInitial("chief_manager")).toBe("R")
  })
})
