import { describe, expect, test } from "bun:test"
import { HarnessEvent, HarnessStatus } from "../../src/harness"

describe("Harness schema", () => {
  test("parses a default safe status without showing fake zero UI data", () => {
    const status = HarnessStatus.parse({
      mode: "safe",
      capabilityCount: 0,
      pendingPermissionCount: 0,
      runningToolCount: 0,
    })

    expect(status.mode).toBe("safe")
    expect(status.capabilityCount).toBe(0)
  })

  test("parses a tool lifecycle event", () => {
    const event = HarnessEvent.parse({
      id: "evt_01",
      sessionID: "ses_01",
      type: "tool.started",
      title: "读取工程目录",
      createdAt: 1779498000000,
      risk: "low",
    })

    expect(event.type).toBe("tool.started")
  })
})
