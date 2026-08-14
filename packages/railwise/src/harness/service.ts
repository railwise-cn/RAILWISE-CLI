import { Marketplace } from "@/marketplace"
import { PermissionNext } from "@/permission/next"
import { Session } from "@/session"
import type { MessageV2 } from "@/session/message-v2"
import { HarnessEvent, HarnessStatus } from "./schema"

export namespace Harness {
  function text(value: unknown) {
    if (value === undefined) return undefined
    const str = typeof value === "string" ? value : JSON.stringify(value)
    if (str.length <= 180) return str
    return str.slice(0, 177) + "..."
  }

  function title(part: MessageV2.ToolPart) {
    if (part.state.status === "running") return part.state.title ?? part.tool
    if (part.state.status === "completed") return part.state.title || part.tool
    return part.tool
  }

  function risk(name: string): HarnessEvent["risk"] {
    if (["bash", "edit", "write", "patch"].some((item) => name.includes(item))) return "high"
    if (["webfetch", "task", "skill"].some((item) => name.includes(item))) return "medium"
    return "low"
  }

  function completed(part: MessageV2.ToolPart) {
    if (part.state.status !== "completed" && part.state.status !== "error") return undefined
    return Math.max(0, part.state.time.end - part.state.time.start)
  }

  function created(part: MessageV2.ToolPart, fallback: number) {
    if (part.state.status === "pending") return fallback
    return part.state.time.start
  }

  function tool(part: MessageV2.ToolPart, fallback: number): HarnessEvent {
    const base = {
      id: `harness:${part.id}:${part.state.status}`,
      sessionID: part.sessionID,
      createdAt: created(part, fallback),
      risk: risk(part.tool),
      capabilityID: `tool:${part.tool}`,
      duration: completed(part),
    }
    if (part.state.status === "pending")
      return HarnessEvent.parse({
        ...base,
        type: "tool.requested",
        title: `准备调用工具：${part.tool}`,
        detail: text(part.state.input),
      })
    if (part.state.status === "running")
      return HarnessEvent.parse({
        ...base,
        type: "tool.started",
        title: `正在执行：${title(part)}`,
        detail: text(part.state.input),
      })
    if (part.state.status === "completed")
      return HarnessEvent.parse({
        ...base,
        type: "tool.completed",
        title: `工具完成：${title(part)}`,
        detail: text(part.state.output),
      })
    return HarnessEvent.parse({
      ...base,
      type: "tool.failed",
      title: `工具失败：${part.tool}`,
      detail: text(part.state.input),
      error: part.state.error,
    })
  }

  function model(info: MessageV2.Assistant) {
    return `${info.providerID}/${info.modelID}`
  }

  async function permissions() {
    return PermissionNext.list().catch(() => [])
  }

  async function latest(input?: { directory?: string }) {
    try {
      return Array.from(Session.list({ directory: input?.directory, limit: 1 }))[0]
    } catch {
      return undefined
    }
  }

  export async function status(input?: { directory?: string; sessionID?: string }) {
    const session = input?.sessionID ? await Session.get(input.sessionID).catch(() => undefined) : await latest(input)
    const messages = session ? await Session.messages({ sessionID: session.id }).catch(() => []) : []
    const assistant = messages
      .map((item) => item.info)
      .filter((item): item is MessageV2.Assistant => item.role === "assistant")
      .at(-1)
    const running = messages
      .flatMap((item) => item.parts)
      .filter((part): part is MessageV2.ToolPart => part.type === "tool")
      .filter((part) => part.state.status === "running").length
    const list = await permissions()
    const matched = await Promise.all(
      list.map(async (item) => ({
        item,
        session: await Session.get(item.sessionID).catch(() => undefined),
      })),
    )
    const pending = input?.sessionID
      ? matched.filter((entry) => entry.item.sessionID === input.sessionID).map((entry) => entry.item)
      : input?.directory
        ? matched.filter((entry) => entry.session?.directory === input.directory).map((entry) => entry.item)
        : list
    const pendingSession = matched.find((entry) => entry.item.id === pending[0]?.id)?.session
    const capabilities = await Marketplace.list()

    return HarnessStatus.parse({
      mode: pending.length > 0 ? "ask" : "safe",
      workspace: session?.directory ?? pendingSession?.directory,
      model: assistant ? model(assistant) : undefined,
      activeAgent: assistant?.agent,
      capabilityCount: capabilities.filter((item) => item.enabled).length,
      pendingPermissionCount: pending.length,
      pendingSessionID: pending[0]?.sessionID,
      runningToolCount: running,
    })
  }

  export async function timeline(input: { sessionID: string }) {
    const session = await Session.get(input.sessionID)
    const messages = await Session.messages({ sessionID: input.sessionID })
    const agents = new Set<string>()
    const models = new Set<string>()
    const events: HarnessEvent[] = [
      HarnessEvent.parse({
        id: `harness:${session.id}:started`,
        sessionID: session.id,
        type: "session.started",
        title: "会话开始",
        detail: session.title,
        createdAt: session.time.created,
        risk: "low",
      }),
    ]

    for (const item of messages) {
      if (item.info.role === "assistant") {
        if (!agents.has(item.info.agent)) {
          agents.add(item.info.agent)
          events.push(
            HarnessEvent.parse({
              id: `harness:${item.info.id}:agent`,
              sessionID: item.info.sessionID,
              type: "agent.selected",
              title: `智能体：${item.info.agent}`,
              createdAt: item.info.time.created,
              risk: "low",
            }),
          )
        }
        if (!models.has(model(item.info))) {
          models.add(model(item.info))
          events.push(
            HarnessEvent.parse({
              id: `harness:${item.info.id}:model`,
              sessionID: item.info.sessionID,
              type: "model.selected",
              title: `模型：${model(item.info)}`,
              createdAt: item.info.time.created,
              risk: "low",
            }),
          )
        }
      }

      events.push(
        ...item.parts.flatMap((part) => {
          if (part.type === "tool") return [tool(part, item.info.time.created)]
          if (part.type === "subtask")
            return [
              HarnessEvent.parse({
                id: `harness:${part.id}:agent`,
                sessionID: part.sessionID,
                type: "agent.selected",
                title: `调用子智能体：${part.agent}`,
                detail: part.description,
                createdAt: item.info.time.created,
                risk: "medium",
              }),
            ]
          if (part.type === "patch")
            return [
              HarnessEvent.parse({
                id: `harness:${part.id}:artifact`,
                sessionID: part.sessionID,
                type: "artifact.created",
                title: "生成代码变更",
                detail: `${part.files.length} 个文件`,
                artifactPath: part.files[0],
                createdAt: item.info.time.created,
                risk: "medium",
              }),
            ]
          return []
        }),
      )

      if (item.info.role === "assistant" && item.info.time.completed) {
        events.push(
          HarnessEvent.parse({
            id: `harness:${item.info.id}:completed`,
            sessionID: item.info.sessionID,
            type: "session.completed",
            title: "本轮回复完成",
            createdAt: item.info.time.completed,
            duration: Math.max(0, item.info.time.completed - item.info.time.created),
            risk: "low",
          }),
        )
      }
    }

    events.push(
      ...(await permissions())
        .filter((item) => item.sessionID === input.sessionID)
        .map((item) =>
          HarnessEvent.parse({
            id: `harness:${item.id}:requested`,
            sessionID: item.sessionID,
            type: "permission.requested",
            title: `等待权限：${item.permission}`,
            detail: text(item.patterns),
            createdAt: Date.now(),
            risk: risk(item.permission),
            capabilityID: `permission:${item.permission}`,
          }),
        ),
    )

    return events.sort((a, b) => a.createdAt - b.createdAt)
  }

  export async function resolvePermission(input: { permissionID: string }) {
    await PermissionNext.reply({
      requestID: input.permissionID,
      reply: "once",
    })
    return true
  }
}
