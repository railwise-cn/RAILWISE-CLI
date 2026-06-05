import { describe, expect, test } from "bun:test"
import { agentDisplayName, agentInitial } from "./agent-display"

describe("agentDisplayName", () => {
  test("uses product-facing names for builtin agents", () => {
    expect(agentDisplayName("chief_manager")).toBe("RAILWISE")
    expect(agentDisplayName("qa_inspector")).toBe("数据质检")
    expect(agentDisplayName("qa_reviewer")).toBe("质量审查")
    expect(agentDisplayName("technical_writer")).toBe("报告编制")
    expect(agentDisplayName("solution_architect")).toBe("方案架构")
    expect(agentDisplayName("commercial_specialist")).toBe("投标商务")
    expect(agentDisplayName("ppt_master")).toBe("汇报生成")
  })

  test("keeps the chief manager product-facing as RAILWISE", () => {
    expect(agentDisplayName({ name: "chief_manager", displayName: "旧入口名称" })).toBe("RAILWISE")
  })

  test("lets configured displayName override non-chief builtin fallbacks", () => {
    expect(agentDisplayName({ name: "qa_inspector", displayName: "外业首检" })).toBe("外业首检")
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
