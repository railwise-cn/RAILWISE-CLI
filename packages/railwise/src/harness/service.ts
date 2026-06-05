import { Marketplace } from "../marketplace"
import { HarnessEvent, HarnessPermissionDecision, HarnessPermissionResult, HarnessStatus } from "./schema"

export namespace Harness {
  export async function status(input: Partial<HarnessStatus> = {}) {
    return HarnessStatus.parse({
      mode: input.mode ?? "safe",
      workspace: input.workspace,
      model: input.model,
      activeAgent: input.activeAgent,
      capabilityCount: input.capabilityCount ?? (await Marketplace.list()).filter((item) => item.enabled).length,
      pendingPermissionCount: input.pendingPermissionCount ?? 0,
      runningToolCount: input.runningToolCount ?? 0,
    })
  }

  export function timeline(sessionID: string, events: HarnessEvent[] = []) {
    return events
      .filter((event) => event.sessionID === sessionID)
      .map((event) => HarnessEvent.parse(event))
      .sort((a, b) => a.createdAt - b.createdAt)
  }

  export function resolvePermission(sessionID: string, permissionID: string, input: HarnessPermissionDecision) {
    return HarnessPermissionResult.parse({
      sessionID,
      permissionID,
      decision: input.decision,
      accepted: input.decision !== "reject",
    })
  }
}
