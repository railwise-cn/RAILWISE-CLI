import { Instance } from "../project/instance"
import { Marketplace } from "../marketplace"
import type { HarnessEvent, HarnessStatus } from "./schema"

export namespace Harness {
  const events = new Map<string, HarnessEvent[]>()

  export async function status(input?: Partial<HarnessStatus>): Promise<HarnessStatus> {
    return {
      mode: input?.mode ?? "safe",
      workspace: input?.workspace ?? Instance.directory,
      model: input?.model,
      activeAgent: input?.activeAgent,
      capabilityCount: input?.capabilityCount ?? (await Marketplace.list()).filter((item) => item.enabled).length,
      pendingPermissionCount: input?.pendingPermissionCount ?? 0,
      runningToolCount: input?.runningToolCount ?? 0,
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
