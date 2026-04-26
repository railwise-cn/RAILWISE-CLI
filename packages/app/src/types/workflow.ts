export type WorkflowEdgeKind = "serial" | "parallel" | "optional"

export type WorkflowNode = {
  id: string
  agent: string
  label: string
  color: string
  x: number
  y: number
}

export type WorkflowEdge = {
  from: string
  to: string
  kind: WorkflowEdgeKind
  label?: string
}

export type Workflow = {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}
