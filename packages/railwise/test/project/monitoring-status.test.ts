import { describe, expect, test } from "bun:test"
import { calcPointStatus } from "../../src/project/monitoring-status"

const threshold = { warning: 20, alert: 30 }

describe("project.monitoring-status", () => {
  test("marks stale points gray", () => {
    expect(calcPointStatus(28, threshold, Date.now() - 73 * 3_600_000)).toBe("gray")
  })

  test("marks near-alert values red", () => {
    expect(calcPointStatus(24, threshold, Date.now() - 3_600_000)).toBe("red")
  })

  test("marks warning range yellow", () => {
    expect(calcPointStatus(16, threshold, Date.now() - 3_600_000)).toBe("yellow")
  })

  test("marks sustained recent trend red", () => {
    expect(calcPointStatus(8, threshold, Date.now() - 3_600_000, [2, 5, 6, 7])).toBe("red")
  })

  test("marks normal values green", () => {
    expect(calcPointStatus(8, threshold, Date.now() - 3_600_000)).toBe("green")
  })
})
