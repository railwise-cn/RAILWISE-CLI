import { describe, expect, test } from "bun:test"
import type { HarnessEvent } from "@railwise/sdk/v2"
import { eventKind, eventStatus, visibleEvents } from "./session-harness-panel"

function event(input: Partial<HarnessEvent> & Pick<HarnessEvent, "type">): HarnessEvent {
  return {
    id: `evt_${input.type}_${input.createdAt ?? 1}`,
    sessionID: "ses_test",
    title: input.title ?? input.type,
    createdAt: input.createdAt ?? 1,
    risk: input.risk ?? "low",
    ...input,
  }
}

describe("SessionHarnessPanel helpers", () => {
  test("groups runtime events by operational kind", () => {
    expect(eventKind(event({ type: "session.started" }))).toBe("运行")
    expect(eventKind(event({ type: "permission.requested" }))).toBe("权限")
    expect(eventKind(event({ type: "tool.started" }))).toBe("工具")
    expect(eventKind(event({ type: "artifact.created" }))).toBe("产物")
    expect(eventKind(event({ type: "skill.loaded" }))).toBe("Skill")
  })

  test("maps Harness event types to user-facing status", () => {
    expect(eventStatus(event({ type: "tool.started" }))).toBe("进行中")
    expect(eventStatus(event({ type: "tool.completed" }))).toBe("已完成")
    expect(eventStatus(event({ type: "tool.failed" }))).toBe("失败")
    expect(eventStatus(event({ type: "permission.requested" }))).toBe("待确认")
    expect(eventStatus(event({ type: "permission.resolved" }))).toBe("已处理")
  })

  test("shows the latest timeline events first", () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event({
        type: "tool.completed",
        title: `事件 ${index}`,
        createdAt: index,
      }),
    )

    expect(visibleEvents(events).map((item) => item.title)).toEqual([
      "事件 9",
      "事件 8",
      "事件 7",
      "事件 6",
      "事件 5",
      "事件 4",
      "事件 3",
      "事件 2",
    ])
  })
})
