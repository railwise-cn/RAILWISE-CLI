import z from "zod"
import { Tool } from "./tool"

import CONDITION_DESCRIPTION from "./adjustment-condition.txt"
import INDIRECT_DESCRIPTION from "./adjustment-indirect.txt"

type Equation = {
  name?: string
  coefficients: Record<string, number>
  observed: number
  weight?: number
}

function row(equation: Equation, unknowns: string[]) {
  return unknowns.map((name) => equation.coefficients[name] ?? 0)
}

function normal(input: { matrix: number[][]; observed: number[]; weights: number[] }) {
  const size = input.matrix[0]?.length ?? 0
  const lhs = Array.from({ length: size }, () => Array.from({ length: size }, () => 0))
  const rhs = Array.from({ length: size }, () => 0)
  input.matrix.forEach((row, index) => {
    row.forEach((a, i) => {
      rhs[i] += a * input.weights[index] * input.observed[index]
      row.forEach((b, j) => {
        lhs[i][j] += a * input.weights[index] * b
      })
    })
  })
  return { lhs, rhs }
}

function solve(lhs: number[][], rhs: number[]) {
  const n = rhs.length
  const aug = lhs.map((row, index) => [...row, rhs[index]])
  for (let col = 0; col < n; col++) {
    const pivot = aug
      .map((row, index) => ({ index, value: Math.abs(row[col]) }))
      .filter((item) => item.index >= col)
      .sort((a, b) => b.value - a.value)[0]
    if (!pivot || pivot.value < 1e-12) throw new Error("normal matrix is singular")
    const current = aug[col]
    aug[col] = aug[pivot.index]
    aug[pivot.index] = current
    const scale = aug[col][col]
    aug[col] = aug[col].map((value) => value / scale)
    aug.forEach((row, index) => {
      if (index === col) return
      const factor = row[col]
      aug[index] = row.map((value, j) => value - factor * aug[col][j])
    })
  }
  return aug.map((row) => row[n])
}

function inverse(lhs: number[][]) {
  return lhs.map((_, index) => solve(lhs, lhs.map((__, j) => (j === index ? 1 : 0))))
}

export const AdjustmentIndirectTool = Tool.define("tool_adjustment_indirect", {
  description: INDIRECT_DESCRIPTION,
  parameters: z.object({
    unknowns: z.array(z.string().min(1)).min(1).max(20).describe("Unknown parameter names in solution order."),
    equations: z
      .array(
        z.object({
          name: z.string().optional(),
          coefficients: z.record(z.string(), z.number()).describe("Design row coefficients by unknown name."),
          observed: z.number().describe("Observed value on the right-hand side of the equation."),
          weight: z.number().positive().optional().describe("Observation weight. Defaults to 1."),
        }),
      )
      .min(1)
      .max(500),
  }),
  async execute(params) {
    if (params.equations.length < params.unknowns.length) {
      throw new Error("equation count must be greater than or equal to unknown count")
    }
    const matrix = params.equations.map((equation) => row(equation, params.unknowns))
    const observed = params.equations.map((equation) => equation.observed)
    const weights = params.equations.map((equation) => equation.weight ?? 1)
    const system = normal({ matrix, observed, weights })
    const values = solve(system.lhs, system.rhs)
    const residuals = matrix.map((item, index) => item.reduce((acc, value, j) => acc + value * values[j], 0) - observed[index])
    const weightedResidualSum = residuals.reduce((acc, residual, index) => acc + weights[index] * residual ** 2, 0)
    const degreesOfFreedom = params.equations.length - params.unknowns.length
    const sigma0 = degreesOfFreedom > 0 ? Math.sqrt(weightedResidualSum / degreesOfFreedom) : 0
    const qxx = inverse(system.lhs)
    const result = {
      unknowns: params.unknowns.map((name, index) => ({
        name,
        value: values[index],
        standardDeviation: sigma0 * Math.sqrt(Math.max(qxx[index]?.[index] ?? 0, 0)),
      })),
      residuals: params.equations.map((equation, index) => ({
        name: equation.name ?? `v${index + 1}`,
        residual: residuals[index],
        weight: weights[index],
      })),
      statistics: {
        observationCount: params.equations.length,
        unknownCount: params.unknowns.length,
        degreesOfFreedom,
        weightedResidualSum,
        unitWeightStdDev: sigma0,
      },
    }
    return {
      title: "Indirect Adjustment",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})

export const AdjustmentConditionTool = Tool.define("tool_adjustment_condition", {
  description: CONDITION_DESCRIPTION,
  parameters: z.object({
    observations: z
      .array(
        z.object({
          name: z.string().min(1),
          value: z.number().describe("Observed value before correction."),
          weight: z.number().positive().optional().describe("Observation weight. Defaults to 1."),
        }),
      )
      .min(1)
      .max(500),
    conditions: z
      .array(
        z.object({
          name: z.string().optional(),
          coefficients: z
            .record(z.string(), z.number())
            .describe("Condition coefficients by observation name. The adjusted observations must satisfy sum(a_i * L_i) + constant = 0."),
          constant: z.number().optional().describe("Constant term in the condition equation. Defaults to 0."),
        }),
      )
      .min(1)
      .max(100),
  }),
  async execute(params) {
    if (params.conditions.length > params.observations.length) {
      throw new Error("condition count must be less than or equal to observation count")
    }
    const names = new Set(params.observations.map((observation) => observation.name))
    if (names.size !== params.observations.length) throw new Error("observation names must be unique")
    const missing = params.conditions
      .flatMap((condition) => Object.keys(condition.coefficients))
      .filter((name) => !names.has(name))
    if (missing.length) throw new Error(`condition references unknown observations: ${[...new Set(missing)].join(", ")}`)

    const matrix = params.conditions.map((condition) =>
      params.observations.map((observation) => condition.coefficients[observation.name] ?? 0),
    )
    const values = params.observations.map((observation) => observation.value)
    const weights = params.observations.map((observation) => observation.weight ?? 1)
    const misclosures = matrix.map(
      (item, index) =>
        item.reduce((acc, value, j) => acc + value * values[j], 0) + (params.conditions[index]?.constant ?? 0),
    )
    const lhs = matrix.map((a) =>
      matrix.map((b) => a.reduce((acc, value, index) => acc + (value * b[index]) / weights[index], 0)),
    )
    const multipliers = solve(lhs, misclosures)
    const corrections = params.observations.map(
      (_, index) => -matrix.reduce((acc, item, j) => acc + item[index] * multipliers[j], 0) / weights[index],
    )
    const adjusted = values.map((value, index) => value + corrections[index])
    const after = matrix.map(
      (item, index) =>
        item.reduce((acc, value, j) => acc + value * adjusted[j], 0) + (params.conditions[index]?.constant ?? 0),
    )
    const weightedCorrectionSum = corrections.reduce((acc, correction, index) => acc + weights[index] * correction ** 2, 0)
    const sigma0 = Math.sqrt(weightedCorrectionSum / params.conditions.length)
    const result = {
      observations: params.observations.map((observation, index) => ({
        name: observation.name,
        observed: observation.value,
        correction: corrections[index],
        adjusted: adjusted[index],
        weight: weights[index],
      })),
      conditions: params.conditions.map((condition, index) => ({
        name: condition.name ?? `condition${index + 1}`,
        misclosureBefore: misclosures[index],
        misclosureAfter: after[index],
      })),
      statistics: {
        observationCount: params.observations.length,
        conditionCount: params.conditions.length,
        degreesOfFreedom: params.conditions.length,
        weightedCorrectionSum,
        unitWeightStdDev: sigma0,
      },
    }
    return {
      title: "Condition Adjustment",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})
