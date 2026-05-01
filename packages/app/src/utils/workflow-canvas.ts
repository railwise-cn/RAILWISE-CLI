import type { Workflow, WorkflowEdge } from "@/types/workflow"

function node(workflow: Workflow, id: string) {
  return workflow.nodes.find((item) => item.id === id)
}

export function edgePath(workflow: Workflow, edge: WorkflowEdge) {
  const from = node(workflow, edge.from)
  const to = node(workflow, edge.to)
  if (!from || !to) return ""
  const start = { x: from.x + 150, y: from.y + 35 }
  const end = { x: to.x, y: to.y + 35 }
  const delta = Math.max(70, Math.abs(end.x - start.x) / 2)
  return `M ${start.x} ${start.y} C ${start.x + delta} ${start.y}, ${end.x - delta} ${end.y}, ${end.x} ${end.y}`
}
