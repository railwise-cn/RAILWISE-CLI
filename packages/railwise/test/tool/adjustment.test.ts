import { expect, test } from "bun:test"
import { AdjustmentConditionTool, AdjustmentIndirectTool } from "../../src/tool/adjustment"

function ctx() {
  return {
    sessionID: "session",
    messageID: "message",
    agent: "test",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    ask: async () => {},
  }
}

test("indirect adjustment solves redundant observation equations", async () => {
  const tool = await AdjustmentIndirectTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          unknowns: ["x", "y"],
          equations: [
            { name: "x observed", coefficients: { x: 1 }, observed: 10 },
            { name: "y observed", coefficients: { y: 1 }, observed: 20 },
            { name: "sum observed", coefficients: { x: 1, y: 1 }, observed: 30.003 },
          ],
        },
        ctx(),
      )
    ).output,
  ) as {
    unknowns: { name: string; value: number; standardDeviation: number }[]
    residuals: { name: string; residual: number }[]
    statistics: { degreesOfFreedom: number; unitWeightStdDev: number }
  }

  expect(result.unknowns.find((item) => item.name === "x")?.value).toBeCloseTo(10.001, 6)
  expect(result.unknowns.find((item) => item.name === "y")?.value).toBeCloseTo(20.001, 6)
  expect(result.residuals.find((item) => item.name === "sum observed")?.residual).toBeCloseTo(-0.001, 6)
  expect(result.statistics.degreesOfFreedom).toBe(1)
  expect(result.statistics.unitWeightStdDev).toBeCloseTo(0.0017320508, 9)
})

test("condition adjustment distributes level-loop closure by observation weights", async () => {
  const tool = await AdjustmentConditionTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          observations: [
            { name: "dh1", value: 100.001 },
            { name: "dh2", value: 200.002, weight: 4 },
            { name: "dh3", value: -300.006 },
          ],
          conditions: [{ name: "loop closure", coefficients: { dh1: 1, dh2: 1, dh3: 1 } }],
        },
        ctx(),
      )
    ).output,
  ) as {
    observations: { name: string; correction: number; adjusted: number }[]
    conditions: { name: string; misclosureBefore: number; misclosureAfter: number }[]
    statistics: { degreesOfFreedom: number; unitWeightStdDev: number }
  }

  expect(result.observations.find((item) => item.name === "dh1")?.correction).toBeCloseTo(0.0013333333, 9)
  expect(result.observations.find((item) => item.name === "dh2")?.adjusted).toBeCloseTo(200.0023333333, 9)
  expect(result.observations.find((item) => item.name === "dh3")?.adjusted).toBeCloseTo(-300.0046666667, 9)
  expect(result.conditions.find((item) => item.name === "loop closure")?.misclosureBefore).toBeCloseTo(-0.003, 9)
  expect(result.conditions.find((item) => item.name === "loop closure")?.misclosureAfter).toBeCloseTo(0, 9)
  expect(result.statistics.degreesOfFreedom).toBe(1)
  expect(result.statistics.unitWeightStdDev).toBeCloseTo(0.002, 9)
})
