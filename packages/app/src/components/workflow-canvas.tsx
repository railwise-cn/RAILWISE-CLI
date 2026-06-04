import { For } from "solid-js"
import { useNavigate } from "@solidjs/router"
import type { Workflow } from "@/types/workflow"
import { edgePath } from "@/utils/workflow-canvas"
import { agentDisplayName } from "@/utils/agent-display"

export function WorkflowCanvas(props: { workflow: Workflow }) {
  const navigate = useNavigate()

  return (
    <div class="workflow-canvas" data-testid="workflow-canvas">
      <svg viewBox="0 0 780 360" role="img" aria-label={props.workflow.name}>
        <For each={props.workflow.edges}>
          {(edge) => (
            <g>
              <path class="workflow-edge" data-testid="workflow-edge" d={edgePath(props.workflow, edge)} />
              <text class="workflow-edge__label">
                <textPath href={`#${props.workflow.id}-${edge.from}-${edge.to}`} startOffset="52%">
                  {edge.label ?? edge.kind}
                </textPath>
              </text>
              <path
                id={`${props.workflow.id}-${edge.from}-${edge.to}`}
                class="workflow-edge__guide"
                d={edgePath(props.workflow, edge)}
              />
            </g>
          )}
        </For>
        <For each={props.workflow.nodes}>
          {(item) => (
            <g
              class="workflow-node"
              data-testid="workflow-node"
              tabIndex={0}
              transform={`translate(${item.x}, ${item.y})`}
              onClick={() => navigate(`/agents/${item.agent}`)}
              onKeyDown={(event) => {
                if (event.key === "Enter") navigate(`/agents/${item.agent}`)
              }}
            >
              <title>{agentDisplayName(item.agent)}</title>
              <rect class="workflow-node__card" width="150" height="70" rx="8" />
              <rect class="workflow-node__bar" width="6" height="70" rx="3" fill={item.color} />
              <text class="workflow-node__label" x="18" y="30">
                {item.label}
              </text>
              <text class="workflow-node__agent" x="18" y="51">
                {agentDisplayName(item.agent)}
              </text>
            </g>
          )}
        </For>
      </svg>
    </div>
  )
}
