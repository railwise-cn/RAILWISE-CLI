import { describe, expect, test } from "bun:test"
import { base64Encode } from "@railwise/util/encode"
import {
  agentRoleLabel,
  agentStudioSummary,
  collaborationTarget,
  modelRouteLabel,
  modelRoutingSummary,
  modelSetupState,
  parseModelRoute,
  professionalSkills,
  recentWorkspaces,
  recommendedProviders,
  updateAgentModelRoute,
} from "./collaboration"

describe("collaborationTarget", () => {
  test("builds a workspace session handoff with the selected agent", () => {
    const target = collaborationTarget({
      directory: "/Users/WANGJIAWEI/CODE/RAILWISE-CLI/",
      agent: "chief_manager",
      prompt: "  检查当前工程资料并列出下一步  ",
    })

    expect(target.directory).toBe("/Users/WANGJIAWEI/CODE/RAILWISE-CLI")
    expect(target.agent).toBe("chief_manager")
    expect(target.key).toBe(base64Encode("/Users/WANGJIAWEI/CODE/RAILWISE-CLI"))
    expect(target.href).toBe(`/${base64Encode("/Users/WANGJIAWEI/CODE/RAILWISE-CLI")}/session`)
    expect(target.prompt).toBe("@chief_manager\n检查当前工程资料并列出下一步")
  })
})

describe("model routing helpers", () => {
  test("deduplicates recent workspaces and hides the global root placeholder", () => {
    const list = recentWorkspaces(
      [
        { worktree: "/Users/me/CODE/RAILWISE-CLI", time: { created: 1, updated: 10 } },
        { worktree: "/", time: { created: 1, updated: 40 } },
        { worktree: "/Users/me/CODE/RAILWISE-CLI/", time: { created: 1, updated: 30 } },
        { worktree: "/Users/me/CODE/RAILWISE-Desktop", time: { created: 1, updated: 20 } },
      ],
      4,
    )

    expect(list.map((project) => project.worktree)).toEqual([
      "/Users/me/CODE/RAILWISE-CLI",
      "/Users/me/CODE/RAILWISE-Desktop",
    ])
  })

  test("summarizes primary and professional collaborators for advanced agent management", () => {
    const summary = agentStudioSummary([
      { name: "chief_manager", mode: "primary" },
      { name: "solution_architect", mode: "all" },
      { name: "ppt_master", mode: "subagent" },
      { name: "hidden", mode: "subagent", hidden: true },
    ])

    expect(summary.total).toBe(3)
    expect(summary.primary).toBe(1)
    expect(summary.collaborators).toBe(2)
  })

  test("uses product-facing role labels instead of coding agent terms", () => {
    expect(agentRoleLabel({ name: "chief_manager", mode: "primary" })).toBe("默认协作")
    expect(agentRoleLabel({ name: "solution_architect", mode: "all" })).toBe("专业智能体")
    expect(agentRoleLabel({ name: "ppt_master", mode: "subagent" })).toBe("专业智能体")
  })

  test("summarizes bound and defaulted agent models", () => {
    const summary = modelRoutingSummary([
      { name: "chief_manager", mode: "primary", model: { providerID: "deepseek", modelID: "deepseek-v4" } },
      { name: "writer", mode: "subagent" },
      { name: "hidden", mode: "subagent", hidden: true },
    ])

    expect(summary.total).toBe(2)
    expect(summary.bound).toBe(1)
    expect(summary.defaulted).toBe(1)
    expect(summary.recommended).toBe("DeepSeek V4")
  })

  test("labels bound models and default fallback", () => {
    expect(modelRouteLabel({ name: "chief_manager", mode: "primary", model: { providerID: "deepseek", modelID: "v4" } })).toBe(
      "deepseek/v4",
    )
    expect(modelRouteLabel({ name: "writer", mode: "subagent" })).toBe("默认 DeepSeek V4")
  })

  test("detects model onboarding state from providers and visible models", () => {
    expect(modelSetupState({ connectedProviders: 0, visibleModels: 0 })).toBe("needs-provider")
    expect(modelSetupState({ connectedProviders: 1, visibleModels: 0 })).toBe("models-hidden")
    expect(modelSetupState({ connectedProviders: 1, visibleModels: 3 })).toBe("ready")
  })

  test("prioritizes DeepSeek and OpenRouter for model onboarding", () => {
    expect(recommendedProviders.map((provider) => provider.id)).toEqual(["deepseek", "openrouter"])
  })

  test("prioritizes Railwise professional skills over generic automation skills", () => {
    const skills = professionalSkills(
      [
        { name: "qa", description: "generic qa", location: "/Users/me/.agents/skills/gstack/qa/SKILL.md" },
        {
          name: "monitoring-design",
          description: "工程监测方案设计",
          location: "/repo/.railwise/skill/monitoring-design/SKILL.md",
        },
        {
          name: "standard-reference",
          description: "规范条文速查",
          location: "/repo/.railwise/skill/standard-reference/SKILL.md",
        },
        {
          name: "data-analysis",
          description: "测绘数据平差与变形分析",
          location: "/repo/.railwise/skill/data-analysis/SKILL.md",
        },
      ],
      3,
    )

    expect(skills.map((skill) => skill.name)).toEqual(["monitoring-design", "data-analysis", "standard-reference"])
  })

  test("parses provider and model route from the matrix select value", () => {
    expect(parseModelRoute("deepseek/deepseek-v4")).toEqual({ providerID: "deepseek", modelID: "deepseek-v4" })
    expect(parseModelRoute("openrouter/anthropic/claude-sonnet-4.5")).toEqual({
      providerID: "openrouter",
      modelID: "anthropic/claude-sonnet-4.5",
    })
    expect(parseModelRoute("")).toBeUndefined()
    expect(parseModelRoute("invalid")).toBeUndefined()
  })

  test("updates agent markdown model binding from the route matrix", () => {
    const raw = "---\ndescription: test\nmodel: railwise/auto\n---\n\nbody"
    const updated = updateAgentModelRoute(raw, "deepseek/deepseek-v4")

    expect(updated).toContain("model: deepseek/deepseek-v4")
    expect(updateAgentModelRoute(updated, "")).not.toContain("model:")
  })
})
