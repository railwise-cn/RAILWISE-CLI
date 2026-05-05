import { describe, expect, test } from "bun:test"
import { agentMentionPrompt, agentModelLabel, capabilityPrompt, collaborationAgents } from "./collaboration"

describe("collaborationAgents", () => {
  test("keeps visible primary agents first and then subagents", () => {
    const agents = collaborationAgents([
      { name: "hidden", mode: "subagent", hidden: true },
      { name: "qa_inspector", mode: "subagent" },
      { name: "chief_manager", mode: "primary" },
      { name: "writer", mode: "subagent" },
    ])

    expect(agents.map((agent) => agent.name)).toEqual(["chief_manager", "qa_inspector", "writer"])
  })
})

describe("agentMentionPrompt", () => {
  test("prepends the selected agent to an existing draft", () => {
    expect(agentMentionPrompt("qa_inspector", "请检查数据")).toBe("@qa_inspector\n请检查数据")
  })
})

describe("capabilityPrompt", () => {
  test("prepends tool and skill instructions without losing the draft", () => {
    expect(capabilityPrompt({ kind: "tool", name: "格式转换" }, "处理 CPIII 数据")).toBe(
      "请调用工具「格式转换」处理当前任务。\n处理 CPIII 数据",
    )
    expect(capabilityPrompt({ kind: "skill", name: "survey-review" }, "")).toBe(
      "请使用 Skill「survey-review」执行当前任务。",
    )
  })
})

describe("agentModelLabel", () => {
  test("shows bound model first and falls back to DeepSeek V4 guidance", () => {
    expect(
      agentModelLabel({
        name: "chief_manager",
        mode: "primary",
        model: { providerID: "deepseek", modelID: "deepseek-v4" },
      }),
    ).toBe("deepseek/deepseek-v4")
    expect(agentModelLabel({ name: "writer", mode: "subagent" })).toBe("默认 DeepSeek V4")
  })
})
