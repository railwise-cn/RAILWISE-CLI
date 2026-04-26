import { describe, expect, test } from "bun:test"
import type { Workflow } from "@/types/workflow"
import { edgePath } from "@/utils/workflow-canvas"

const workflow: Workflow = {
  id: "sample",
  name: "测试工作流",
  description: "测试",
  nodes: [
    { id: "a", agent: "chief", label: "统筹", color: "var(--accent-primary)", x: 0, y: 0 },
    { id: "b", agent: "writer", label: "写作", color: "var(--accent-secondary)", x: 240, y: 80 },
  ],
  edges: [{ from: "a", to: "b", kind: "serial", label: "交付" }],
}

describe("WorkflowCanvas", () => {
  test("builds deterministic bezier path between workflow nodes", () => {
    expect(edgePath(workflow, workflow.edges[0])).toBe("M 150 35 C 220 35, 170 115, 240 115")
  })

  test("keeps a minimum bezier control distance for nearby nodes", () => {
    expect(edgePath(
      { ...workflow, nodes: [{ ...workflow.nodes[0] }, { ...workflow.nodes[1], x: 180, y: 0 }] },
      workflow.edges[0],
    )).toBe("M 150 35 C 220 35, 110 35, 180 35")
  })

  test("returns an empty path when a workflow edge references a missing node", () => {
    expect(edgePath(workflow, { from: "missing", to: "b", kind: "serial" })).toBe("")
  })

  test("returns an empty path when the target node is missing", () => {
    expect(edgePath(workflow, { from: "a", to: "missing", kind: "parallel" })).toBe("")
  })
})
