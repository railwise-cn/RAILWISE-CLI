import { Marketplace } from "../marketplace"
import { Session } from "../session"
import { MessageV2 } from "../session/message-v2"
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

  function detail(value: string | undefined) {
    if (!value) return undefined
    return value.length > 240 ? value.slice(0, 237) + "..." : value
  }

  function event(input: Omit<HarnessEvent, "risk"> & Partial<Pick<HarnessEvent, "risk">>) {
    return HarnessEvent.parse({
      risk: "low",
      ...input,
    })
  }

  function tool(part: MessageV2.ToolPart): HarnessEvent[] {
    const title =
      part.state.status === "completed" || part.state.status === "running"
        ? part.state.title || part.tool
        : part.tool

    if (part.state.status === "pending") {
      return [
        event({
          id: `evt_${part.id}_requested`,
          sessionID: part.sessionID,
          type: "tool.requested",
          title,
          detail: detail(part.state.raw),
          createdAt: Date.now(),
          capabilityID: `railwise.tool.${part.tool}`,
        }),
      ]
    }

    const started = event({
      id: `evt_${part.id}_started`,
      sessionID: part.sessionID,
      type: "tool.started",
      title,
      createdAt: part.state.time.start,
      capabilityID: `railwise.tool.${part.tool}`,
    })

    if (part.state.status === "running") return [started]

    if (part.state.status === "error") {
      return [
        started,
        event({
          id: `evt_${part.id}_failed`,
          sessionID: part.sessionID,
          type: "tool.failed",
          title,
          detail: detail(part.state.error),
          error: part.state.error,
          createdAt: part.state.time.end,
          duration: Math.max(0, part.state.time.end - part.state.time.start),
          capabilityID: `railwise.tool.${part.tool}`,
        }),
      ]
    }

    return [
      started,
      event({
        id: `evt_${part.id}_completed`,
        sessionID: part.sessionID,
        type: "tool.completed",
        title,
        detail: detail(part.state.output),
        createdAt: part.state.time.end,
        duration: Math.max(0, part.state.time.end - part.state.time.start),
        capabilityID: `railwise.tool.${part.tool}`,
        artifactPath: part.state.attachments?.[0]?.source?.type === "file" ? part.state.attachments[0].source.path : undefined,
      }),
    ]
  }

  export async function timeline(sessionID: string, events: HarnessEvent[] = []) {
    const recorded = events
      .filter((event) => event.sessionID === sessionID)
      .map((event) => HarnessEvent.parse(event))
    const session = await Session.get(sessionID).catch(() => undefined)
    if (!session) return recorded.sort((a, b) => a.createdAt - b.createdAt)

    const messages = await Session.messages({ sessionID }).catch((): MessageV2.WithParts[] => [])
    const firstUser = messages.map((message) => message.info).find((message) => message.role === "user")
    const firstAssistant = messages.map((message) => message.info).find((message) => message.role === "assistant")
    const derived = [
      event({
        id: `evt_${session.id}_started`,
        sessionID,
        type: "session.started",
        title: session.title,
        detail: session.directory,
        createdAt: session.time.created,
      }),
      ...(firstUser
        ? [
            event({
              id: `evt_${firstUser.id}_model`,
              sessionID,
              type: "model.selected",
              title: `${firstUser.model.providerID}/${firstUser.model.modelID}`,
              createdAt: firstUser.time.created,
            }),
            event({
              id: `evt_${firstUser.id}_agent`,
              sessionID,
              type: "agent.selected",
              title: firstUser.agent,
              createdAt: firstUser.time.created,
            }),
          ]
        : []),
      ...(firstAssistant && firstAssistant.time.completed
        ? [
            event({
              id: `evt_${firstAssistant.id}_completed`,
              sessionID,
              type: "session.completed",
              title: session.title,
              createdAt: firstAssistant.time.completed,
              duration: Math.max(0, firstAssistant.time.completed - session.time.created),
            }),
          ]
        : []),
      ...messages.flatMap((message) =>
        message.parts.flatMap((part) => (part.type === "tool" ? tool(part) : [])),
      ),
    ]

    return [...recorded, ...derived].sort((a, b) => a.createdAt - b.createdAt)
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
