import { Context } from "effect"
import type { InstanceContext } from "@/project/instance-context"
import type { WorkspaceV2 } from "@railwise/core/workspace"

export const InstanceRef = Context.Reference<InstanceContext | undefined>("~railwise/InstanceRef", {
  defaultValue: () => undefined,
})

export const WorkspaceRef = Context.Reference<WorkspaceV2.ID | undefined>("~railwise/WorkspaceRef", {
  defaultValue: () => undefined,
})
