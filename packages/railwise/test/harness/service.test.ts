import { describe, expect, test } from "bun:test"
import { Harness } from "../../src/harness"

describe("Harness service", () => {
  test("returns enabled built-in capabilities in safe mode", async () => {
    const status = await Harness.status({ workspace: "/tmp/railwise" })

    expect(status.mode).toBe("safe")
    expect(status.workspace).toBe("/tmp/railwise")
    expect(status.capabilityCount).toBeGreaterThan(0)
  })

  test("records and clears timeline events by session", () => {
    Harness.clear("ses_test")
    Harness.record({
      id: "evt_test",
      sessionID: "ses_test",
      type: "plan.created",
      title: "生成执行计划",
      createdAt: 1779498000000,
      risk: "low",
    })

    expect(Harness.timeline("ses_test")).toHaveLength(1)
    Harness.clear("ses_test")
    expect(Harness.timeline("ses_test")).toHaveLength(0)
  })
})
