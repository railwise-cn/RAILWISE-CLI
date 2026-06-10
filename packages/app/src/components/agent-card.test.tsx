import { describe, expect, test } from "bun:test"
import { modeLabel } from "@/utils/agent-card"
import { readPermission, readScalar, shortDescription, stripFrontmatter } from "@/utils/agent-markdown"

describe("AgentCard", () => {
  test("shortens long descriptions without losing readable context", () => {
    expect(
      shortDescription("Coordinates complex rail engineering workflows and delegates to specialist agents.", 36),
    ).toBe("Coordinates complex rail engineerin…")
  })

  test("keeps short descriptions unchanged", () => {
    expect(shortDescription("轨道监测")).toBe("轨道监测")
  })

  test("maps known modes to Chinese labels", () => {
    expect(modeLabel("primary")).toBe("默认协作")
    expect(modeLabel("subagent")).toBe("专业智能体")
    expect(modeLabel("all")).toBe("专业智能体")
  })

  test("strips yaml frontmatter before markdown preview", () => {
    expect(stripFrontmatter("---\nname: chief\n---\n\n# Chief\n正文")).toBe("# Chief\n正文")
  })

  test("reads scalar and permission values from frontmatter", () => {
    const raw = '---\nname: chief\nmodel: "gpt-5"\npermission:\n  edit: ask\n---\n\nbody'
    expect(readScalar(raw, "model")).toBe("gpt-5")
    expect(readPermission(raw, "edit")).toBe("ask")
  })
})
