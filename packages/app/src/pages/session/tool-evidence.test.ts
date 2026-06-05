import { describe, expect, test } from "bun:test"
import type { ToolPart } from "@railwise/sdk/v2/client"
import { toolEvidence } from "./tool-evidence"

function completed(input: ToolPart["state"]["input"], metadata: Record<string, unknown>, output = "闭合差满足限差。"): ToolPart {
  return {
    id: "part",
    sessionID: "session",
    messageID: "message",
    type: "tool",
    callID: "call",
    tool: "survey_calculator_leveling_closure",
    state: {
      status: "completed",
      input,
      output,
      title: "水准闭合差检核",
      metadata,
      time: { start: 1, end: 2 },
      attachments: [
        {
          id: "attachment",
          sessionID: "session",
          messageID: "message",
          type: "file",
          url: "file:///tmp/railwise-e2e/worktree/成果报告.md",
          mime: "text/markdown",
          filename: "成果报告.md",
          source: { type: "file", path: "/tmp/railwise-e2e/worktree/成果报告.md", text: { value: "", start: 0, end: 0 } },
        },
      ],
    },
  }
}

describe("toolEvidence", () => {
  test("summarizes completed tool input, output, risk and artifacts", () => {
    const evidence = toolEvidence(
      completed(
        { path: "/tmp/railwise-e2e/worktree/复测资料", closure_mm: 2.2, tolerance_mm: 10 },
        { pass: true, outputPath: "/tmp/railwise-e2e/worktree/闭合差复核.md" },
      ),
    )

    expect(evidence.input).toContain("复测资料")
    expect(evidence.output).toContain("闭合差满足限差")
    expect(evidence.risk.label).toBe("通过")
    expect(evidence.artifacts.map((item) => item.label)).toEqual(["成果报告.md", "闭合差复核.md"])
  })

  test("marks missing material and alerts as needs review", () => {
    expect(toolEvidence(completed({ path: "资料" }, { missing: ["drawing"], alerts: 0 })).risk.label).toBe("需复核")
    expect(toolEvidence(completed({ path: "数据" }, { missing: [], alerts: 3 })).risk.label).toBe("需复核")
  })
})
