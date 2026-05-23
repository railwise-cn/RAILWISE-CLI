import { Instance } from "../project/instance"
import { Marketplace } from "../marketplace"
import type { HarnessEvent, HarnessStatus } from "./schema"

export namespace Harness {
  const events = new Map<string, HarnessEvent[]>()

  function counts() {
    const key = (event: HarnessEvent) => {
      if (event.type === "permission.requested") return event.id
      if (event.type === "permission.resolved") return event.detail ?? event.id.split(":")[0]
      return event.detail ?? event.capabilityID ?? event.id
    }
    const state = Array.from(events.values())
      .flat()
      .sort((a, b) => a.createdAt - b.createdAt)
      .reduce(
        (state, event) => {
          const id = key(event)
          if (event.type === "permission.requested") state.permission.add(id)
          if (event.type === "permission.resolved") state.permission.delete(id)
          if (event.type === "tool.started") state.tool.add(id)
          if (event.type === "tool.completed" || event.type === "tool.failed") state.tool.delete(id)
          return state
        },
        { permission: new Set<string>(), tool: new Set<string>() },
      )
    return {
      pendingPermissionCount: state.permission.size,
      runningToolCount: state.tool.size,
    }
  }

  export async function status(input?: Partial<HarnessStatus>): Promise<HarnessStatus> {
    const active = counts()
    return {
      mode: input?.mode ?? "safe",
      workspace: input?.workspace ?? Instance.directory,
      model: input?.model,
      activeAgent: input?.activeAgent,
      capabilityCount: input?.capabilityCount ?? (await Marketplace.list()).filter((item) => item.enabled).length,
      pendingPermissionCount: input?.pendingPermissionCount ?? active.pendingPermissionCount,
      runningToolCount: input?.runningToolCount ?? active.runningToolCount,
    }
  }

  export function timeline(sessionID: string) {
    return events.get(sessionID) ?? []
  }

  export function record(event: HarnessEvent) {
    events.set(event.sessionID, [...timeline(event.sessionID), event])
    return event
  }

  export function clear(sessionID: string) {
    events.delete(sessionID)
  }
}
