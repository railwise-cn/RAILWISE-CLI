import z from "zod"

export const HarnessMode = z.enum(["safe", "ask", "auto"]).meta({ ref: "HarnessMode" })
export const HarnessRisk = z.enum(["low", "medium", "high"]).meta({ ref: "HarnessRisk" })
export const HarnessEventType = z
  .enum([
    "session.started",
    "plan.created",
    "agent.selected",
    "model.selected",
    "skill.loaded",
    "tool.requested",
    "permission.requested",
    "permission.resolved",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "artifact.created",
    "session.completed",
  ])
  .meta({ ref: "HarnessEventType" })

export const HarnessEvent = z
  .object({
    id: z.string(),
    sessionID: z.string(),
    type: HarnessEventType,
    title: z.string(),
    detail: z.string().optional(),
    createdAt: z.number().int(),
    duration: z.number().int().optional(),
    risk: HarnessRisk.default("low"),
    capabilityID: z.string().optional(),
    artifactPath: z.string().optional(),
    error: z.string().optional(),
  })
  .meta({ ref: "HarnessEvent" })

export const HarnessStatus = z
  .object({
    mode: HarnessMode,
    workspace: z.string().optional(),
    model: z.string().optional(),
    activeAgent: z.string().optional(),
    capabilityCount: z.number().int(),
    pendingPermissionCount: z.number().int(),
    runningToolCount: z.number().int(),
  })
  .meta({ ref: "HarnessStatus" })

export type HarnessEvent = z.infer<typeof HarnessEvent>
export type HarnessStatus = z.infer<typeof HarnessStatus>
