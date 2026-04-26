import { BusEvent } from "@/bus/bus-event"
import z from "zod"

/**
 * Fires after .railwise/agent/:name.md is written.
 * The frontend SSE listener refreshes /agents card wall and invalidates
 * any local Agent.Info cache.
 */
export const AgentUpdated = BusEvent.define(
  "agent.updated",
  z.object({
    name: z.string(),
  }),
)

/**
 * Fires when a workflow run completes.
 * M3 wires this into the chief_manager session lifecycle.
 */
export const WorkflowCompleted = BusEvent.define(
  "agent.workflow.completed",
  z.object({
    workflowId: z.string(),
    sessionId: z.string(),
    durationMs: z.number(),
  }),
)
