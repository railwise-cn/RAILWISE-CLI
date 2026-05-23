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

  export async function trackTool<T>(
    input: {
      sessionID: string
      messageID?: string
      callID?: string
      tool: string
      title: string
      completedTitle?: (result: T) => string
      capabilityID?: string
      risk?: HarnessEvent["risk"]
    },
    run: () => Promise<T>,
  ) {
    const started = Date.now()
    const id = input.callID ?? (input.messageID ? `${input.messageID}:${input.tool}` : `${input.tool}:${started}`)
    record({
      id: `${id}:tool:${input.tool}:started`,
      sessionID: input.sessionID,
      type: "tool.started",
      title: input.title,
      detail: id,
      createdAt: started,
      risk: input.risk ?? "low",
      capabilityID: input.capabilityID ?? input.tool,
    })
    return run()
      .then((result) => {
        const end = Date.now()
        record({
          id: `${id}:tool:${input.tool}:completed`,
          sessionID: input.sessionID,
          type: "tool.completed",
          title: input.completedTitle?.(result) ?? input.title,
          detail: id,
          createdAt: end,
          duration: end - started,
          risk: input.risk ?? "low",
          capabilityID: input.capabilityID ?? input.tool,
        })
        return result
      })
      .catch((error) => {
        const end = Date.now()
        record({
          id: `${id}:tool:${input.tool}:failed`,
          sessionID: input.sessionID,
          type: "tool.failed",
          title: `工具失败 ${input.tool}`,
          detail: id,
          createdAt: end,
          duration: end - started,
          risk: "medium",
          capabilityID: input.capabilityID ?? input.tool,
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      })
  }

  export function clear(sessionID: string) {
    events.delete(sessionID)
  }
}
