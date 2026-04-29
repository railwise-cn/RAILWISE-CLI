import { expect, test } from "bun:test"
import { AdjustmentIndirectTool } from "../../src/tool/adjustment"

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
