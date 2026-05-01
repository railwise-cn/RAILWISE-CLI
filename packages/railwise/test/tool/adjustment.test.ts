import { expect, test } from "bun:test"
import {
  AdjustmentConditionTool,
  AdjustmentFreeNetworkTool,
  AdjustmentIndirectTool,
  AdjustmentRobustTool,
  GrossErrorDetectionTool,
  VarianceComponentTool,
} from "../../src/tool/adjustment"

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

function read(output: string) {
  return JSON.parse(output) as {
    method?: string
    statistics: Record<string, unknown>
  } & Record<string, unknown>
}

test("survey adjustment tools expose stable workflow result contracts", async () => {
  const rows = await Promise.all(
    [
      async () => {
        const tool = await AdjustmentIndirectTool.init()
        const result = await tool.execute(
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
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
      async () => {
        const tool = await AdjustmentFreeNetworkTool.init()
        const result = await tool.execute(
          {
            unknowns: ["x1", "x2"],
            equations: [
              { name: "baseline_a", coefficients: { x1: -1, x2: 1 }, observed: 10 },
              { name: "baseline_b", coefficients: { x1: -1, x2: 1 }, observed: 10.02 },
            ],
            constraints: [{ name: "centroid", coefficients: { x1: 1, x2: 1 }, value: 0 }],
          },
          ctx(),
        )
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
      async () => {
        const tool = await VarianceComponentTool.init()
        const result = await tool.execute(
          {
            unknowns: ["x"],
            referenceGroup: "distance",
            equations: [
              { name: "distance_a", group: "distance", coefficients: { x: 1 }, observed: 10 },
              { name: "distance_b", group: "distance", coefficients: { x: 1 }, observed: 10.02 },
              { name: "angle_a", group: "angle", coefficients: { x: 1 }, observed: 10.5 },
              { name: "angle_b", group: "angle", coefficients: { x: 1 }, observed: 9.5 },
            ],
          },
          ctx(),
        )
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
      async () => {
        const tool = await AdjustmentRobustTool.init()
        const result = await tool.execute(
          {
            unknowns: ["x"],
            equations: [
              { name: "clean_a", coefficients: { x: 1 }, observed: 10 },
              { name: "clean_b", coefficients: { x: 1 }, observed: 10.01 },
              { name: "clean_c", coefficients: { x: 1 }, observed: 9.99 },
              { name: "clean_d", coefficients: { x: 1 }, observed: 10 },
              { name: "outlier", coefficients: { x: 1 }, observed: 13 },
            ],
            k0: 0.8,
            k1: 1.6,
            minWeightFactor: 0.05,
          },
          ctx(),
        )
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
      async () => {
        const tool = await GrossErrorDetectionTool.init()
        const result = await tool.execute(
          {
            sigma0: 0.002,
            threshold: 3,
            residuals: [
              { name: "baseline_north", residual: 0.001, weight: 1 },
              { name: "baseline_east", residual: -0.012, weight: 1 },
              { name: "closure_vector", residual: 0.0005, weight: 4 },
            ],
          },
          ctx(),
        )
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
      async () => {
        const tool = await AdjustmentConditionTool.init()
        const result = await tool.execute(
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
        const data = read(result.output)
        expect(result.metadata).toMatchObject(data.statistics)
        return {
          title: result.title,
          method: data.method ?? null,
          keys: Object.keys(data).sort(),
          stats: data.statistics,
        }
      },
    ].map((run) => run()),
  )

  expect(rows).toMatchObject([
    {
      title: "Indirect Adjustment",
      method: null,
      keys: ["residuals", "statistics", "unknowns"],
      stats: { observationCount: 3, unknownCount: 2, degreesOfFreedom: 1 },
    },
    {
      title: "Free Network Adjustment",
      method: "constrained_free_network_adjustment",
      keys: ["constraints", "method", "residuals", "statistics", "unknowns"],
      stats: { observationCount: 2, unknownCount: 2, datumConstraintCount: 1, degreesOfFreedom: 1 },
    },
    {
      title: "Variance Component Estimation",
      method: "helmert_variance_component_estimation",
      keys: ["components", "method", "referenceGroup", "residuals", "statistics", "unknowns"],
      stats: { observationCount: 4, unknownCount: 1, groupCount: 2, degreesOfFreedom: 3 },
    },
    {
      title: "Robust Adjustment",
      method: "iggiii_robust_adjustment",
      keys: [
        "converged",
        "downweighted",
        "iterations",
        "k0",
        "k1",
        "method",
        "minWeightFactor",
        "residuals",
        "statistics",
        "tolerance",
        "unknowns",
      ],
      stats: { observationCount: 5, unknownCount: 1, degreesOfFreedom: 4, downweightedCount: 1 },
    },
    {
      title: "Gross Error Detection",
      method: "baarda_standardized_residual",
      keys: ["grossErrors", "method", "sigma0", "statistics", "tests", "threshold"],
      stats: { observationCount: 3, grossErrorCount: 1, threshold: 3 },
    },
    {
      title: "Condition Adjustment",
      method: null,
      keys: ["conditions", "observations", "statistics"],
      stats: { observationCount: 3, conditionCount: 1, degreesOfFreedom: 1 },
    },
  ])
})

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

test("gross error detection flags standardized residual outliers", async () => {
  const tool = await GrossErrorDetectionTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          sigma0: 0.002,
          threshold: 3,
          residuals: [
            { name: "baseline_north", residual: 0.001, weight: 1 },
            { name: "baseline_east", residual: -0.012, weight: 1 },
            { name: "closure_vector", residual: 0.0005, weight: 4 },
          ],
        },
        ctx(),
      )
    ).output,
  ) as {
    grossErrors: { name: string; statistic: number }[]
    statistics: { grossErrorCount: number; maxStatistic: number }
  }

  expect(result.grossErrors.map((item) => item.name)).toEqual(["baseline_east"])
  expect(result.grossErrors[0]?.statistic).toBeCloseTo(6, 9)
  expect(result.statistics.grossErrorCount).toBe(1)
  expect(result.statistics.maxStatistic).toBeCloseTo(6, 9)
})

test("gross error detection can run preliminary indirect adjustment", async () => {
  const tool = await GrossErrorDetectionTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          threshold: 3,
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
    grossErrors: unknown[]
    preliminary: { statistics: { degreesOfFreedom: number; unitWeightStdDev: number } }
  }

  expect(result.grossErrors).toEqual([])
  expect(result.preliminary.statistics.degreesOfFreedom).toBe(1)
  expect(result.preliminary.statistics.unitWeightStdDev).toBeCloseTo(0.0017320508, 9)
})

test("free network adjustment solves datum-constrained rank deficient equations", async () => {
  const tool = await AdjustmentFreeNetworkTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          unknowns: ["x1", "x2"],
          equations: [
            { name: "baseline_a", coefficients: { x1: -1, x2: 1 }, observed: 10 },
            { name: "baseline_b", coefficients: { x1: -1, x2: 1 }, observed: 10.02 },
          ],
          constraints: [{ name: "centroid", coefficients: { x1: 1, x2: 1 }, value: 0 }],
        },
        ctx(),
      )
    ).output,
  ) as {
    unknowns: { name: string; value: number }[]
    residuals: { name: string; residual: number }[]
    constraints: { name: string; residual: number }[]
    statistics: { datumConstraintCount: number; degreesOfFreedom: number; unitWeightStdDev: number }
  }

  expect(result.unknowns.find((item) => item.name === "x1")?.value).toBeCloseTo(-5.005, 9)
  expect(result.unknowns.find((item) => item.name === "x2")?.value).toBeCloseTo(5.005, 9)
  expect(result.residuals.find((item) => item.name === "baseline_a")?.residual).toBeCloseTo(0.01, 9)
  expect(result.residuals.find((item) => item.name === "baseline_b")?.residual).toBeCloseTo(-0.01, 9)
  expect(result.constraints.find((item) => item.name === "centroid")?.residual).toBeCloseTo(0, 9)
  expect(result.statistics.datumConstraintCount).toBe(1)
  expect(result.statistics.degreesOfFreedom).toBe(1)
  expect(result.statistics.unitWeightStdDev).toBeCloseTo(Math.sqrt(0.0002), 9)
})

test("variance component estimation separates mixed observation groups", async () => {
  const tool = await VarianceComponentTool.init()
  const result = JSON.parse(
    (
      await tool.execute(
        {
          unknowns: ["x"],
          referenceGroup: "distance",
          equations: [
            { name: "distance_a", group: "distance", coefficients: { x: 1 }, observed: 10 },
            { name: "distance_b", group: "distance", coefficients: { x: 1 }, observed: 10.02 },
            { name: "angle_a", group: "angle", coefficients: { x: 1 }, observed: 10.5 },
            { name: "angle_b", group: "angle", coefficients: { x: 1 }, observed: 9.5 },
          ],
        },
        ctx(),
      )
    ).output,
  ) as {
    components: {
      name: string
      redundancy: number
      varianceFactor: number
      relativeVarianceFactor: number
      suggestedWeightFactor: number
    }[]
    statistics: { groupCount: number; degreesOfFreedom: number; referenceVarianceFactor: number }
  }

  const distance = result.components.find((item) => item.name === "distance")
  const angle = result.components.find((item) => item.name === "angle")

  expect(result.statistics.groupCount).toBe(2)
  expect(result.statistics.degreesOfFreedom).toBe(3)
  expect(result.statistics.referenceVarianceFactor).toBeCloseTo(0.0001666667, 9)
  expect(distance?.redundancy).toBeCloseTo(1.5, 9)
  expect(distance?.relativeVarianceFactor).toBeCloseTo(1, 9)
  expect(angle?.varianceFactor).toBeCloseTo(0.3333666667, 9)
  expect(angle?.relativeVarianceFactor).toBeGreaterThan(1000)
  expect(angle?.suggestedWeightFactor).toBeLessThan(0.001)
})

test("robust adjustment downweights an outlying observation", async () => {
  const indirectTool = await AdjustmentIndirectTool.init()
  const robustTool = await AdjustmentRobustTool.init()
  const equations = [
    { name: "clean_a", coefficients: { x: 1 }, observed: 10 },
    { name: "clean_b", coefficients: { x: 1 }, observed: 10.01 },
    { name: "clean_c", coefficients: { x: 1 }, observed: 9.99 },
    { name: "clean_d", coefficients: { x: 1 }, observed: 10 },
    { name: "outlier", coefficients: { x: 1 }, observed: 13 },
  ]
  const indirect = JSON.parse(
    (
      await indirectTool.execute(
        {
          unknowns: ["x"],
          equations,
        },
        ctx(),
      )
    ).output,
  ) as {
    unknowns: { name: string; value: number }[]
  }
  const result = JSON.parse(
    (
      await robustTool.execute(
        {
          unknowns: ["x"],
          equations,
          k0: 0.8,
          k1: 1.6,
          minWeightFactor: 0.05,
        },
        ctx(),
      )
    ).output,
  ) as {
    converged: boolean
    unknowns: { name: string; value: number }[]
    downweighted: { name: string; weightFactor: number }[]
    statistics: { iterationCount: number; downweightedCount: number }
  }

  const leastSquares = indirect.unknowns.find((item) => item.name === "x")?.value ?? 0
  const robust = result.unknowns.find((item) => item.name === "x")?.value ?? 0

  expect(Math.abs(robust - 10)).toBeLessThan(Math.abs(leastSquares - 10))
  expect(result.downweighted.map((item) => item.name)).toEqual(["outlier"])
  expect(result.downweighted[0]?.weightFactor).toBeCloseTo(0.05, 9)
  expect(result.statistics.downweightedCount).toBe(1)
  expect(result.statistics.iterationCount).toBeGreaterThanOrEqual(2)
  expect(result.converged).toBe(true)
})
