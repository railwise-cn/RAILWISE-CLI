import z from "zod"
import { Tool } from "./tool"

import CONDITION_DESCRIPTION from "./adjustment-condition.txt"
import FREE_NETWORK_DESCRIPTION from "./adjustment-free-network.txt"
import GROSS_ERROR_DESCRIPTION from "./gross-error-detection.txt"
import INDIRECT_DESCRIPTION from "./adjustment-indirect.txt"
import ROBUST_DESCRIPTION from "./adjustment-robust.txt"
import VARIANCE_COMPONENT_DESCRIPTION from "./adjustment-variance-component.txt"

type Equation = {
  name?: string
  coefficients: Record<string, number>
  observed: number
  weight?: number
}

type Residual = {
  name?: string
  residual: number
  weight?: number
  standardDeviation?: number
}

type Constraint = {
  name?: string
  coefficients: Record<string, number>
  value?: number
}

type VarianceEquation = Equation & {
  group?: string
}

function row(equation: Equation, unknowns: string[]) {
  return unknowns.map((name) => equation.coefficients[name] ?? 0)
}

function constraint(input: Constraint, unknowns: string[]) {
  return unknowns.map((name) => input.coefficients[name] ?? 0)
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

function quadratic(matrix: number[][], vector: number[]) {
  return vector.reduce(
    (acc, value, i) =>
      acc + value * vector.reduce((sum, item, j) => sum + item * (matrix[i]?.[j] ?? 0), 0),
    0,
  )
}

function indirect(input: { unknowns: string[]; equations: Equation[] }) {
  if (input.equations.length < input.unknowns.length) {
    throw new Error("equation count must be greater than or equal to unknown count")
  }
  const matrix = input.equations.map((equation) => row(equation, input.unknowns))
  const observed = input.equations.map((equation) => equation.observed)
  const weights = input.equations.map((equation) => equation.weight ?? 1)
  const system = normal({ matrix, observed, weights })
  const values = solve(system.lhs, system.rhs)
  const residuals = matrix.map((item, index) => item.reduce((acc, value, j) => acc + value * values[j], 0) - observed[index])
  const weightedResidualSum = residuals.reduce((acc, residual, index) => acc + weights[index] * residual ** 2, 0)
  const degreesOfFreedom = input.equations.length - input.unknowns.length
  const sigma0 = degreesOfFreedom > 0 ? Math.sqrt(weightedResidualSum / degreesOfFreedom) : 0
  const qxx = inverse(system.lhs)
  return {
    unknowns: input.unknowns.map((name, index) => ({
      name,
      value: values[index],
      standardDeviation: sigma0 * Math.sqrt(Math.max(qxx[index]?.[index] ?? 0, 0)),
    })),
    residuals: input.equations.map((equation, index) => ({
      name: equation.name ?? `v${index + 1}`,
      residual: residuals[index],
      weight: weights[index],
    })),
    statistics: {
      observationCount: input.equations.length,
      unknownCount: input.unknowns.length,
      degreesOfFreedom,
      weightedResidualSum,
      unitWeightStdDev: sigma0,
    },
  }
}

function free(input: { unknowns: string[]; equations: Equation[]; constraints: Constraint[] }) {
  if (!input.constraints.length) throw new Error("datum constraints are required for free network adjustment")
  if (input.equations.length + input.constraints.length < input.unknowns.length) {
    throw new Error("equations plus datum constraints must be greater than or equal to unknown count")
  }
  const known = new Set(input.unknowns)
  const missing = input.constraints.flatMap((item) => Object.keys(item.coefficients)).filter((name) => !known.has(name))
  if (missing.length) throw new Error(`datum constraints reference unknown parameters: ${[...new Set(missing)].join(", ")}`)

  const matrix = input.equations.map((equation) => row(equation, input.unknowns))
  const observed = input.equations.map((equation) => equation.observed)
  const weights = input.equations.map((equation) => equation.weight ?? 1)
  const system = normal({ matrix, observed, weights })
  const constraints = input.constraints.map((item) => constraint(item, input.unknowns))
  const lhs = [
    ...system.lhs.map((item, index) => [...item, ...constraints.map((datum) => datum[index])]),
    ...constraints.map((item) => [...item, ...Array.from({ length: input.constraints.length }, () => 0)]),
  ]
  const solution = solve(lhs, [...system.rhs, ...input.constraints.map((item) => item.value ?? 0)])
  const values = solution.slice(0, input.unknowns.length)
  const residuals = matrix.map((item, index) => item.reduce((acc, value, j) => acc + value * values[j], 0) - observed[index])
  const weightedResidualSum = residuals.reduce((acc, residual, index) => acc + weights[index] * residual ** 2, 0)
  const degreesOfFreedom = input.equations.length - input.unknowns.length + input.constraints.length
  const sigma0 = degreesOfFreedom > 0 ? Math.sqrt(weightedResidualSum / degreesOfFreedom) : 0
  const qxx = inverse(lhs).slice(0, input.unknowns.length).map((item) => item.slice(0, input.unknowns.length))
  return {
    method: "constrained_free_network_adjustment",
    unknowns: input.unknowns.map((name, index) => ({
      name,
      value: values[index],
      standardDeviation: sigma0 * Math.sqrt(Math.max(qxx[index]?.[index] ?? 0, 0)),
    })),
    residuals: input.equations.map((equation, index) => ({
      name: equation.name ?? `v${index + 1}`,
      residual: residuals[index],
      weight: weights[index],
    })),
    constraints: input.constraints.map((item, index) => ({
      name: item.name ?? `datum${index + 1}`,
      value: item.value ?? 0,
      residual: constraints[index].reduce((acc, value, j) => acc + value * values[j], 0) - (item.value ?? 0),
    })),
    statistics: {
      observationCount: input.equations.length,
      unknownCount: input.unknowns.length,
      datumConstraintCount: input.constraints.length,
      degreesOfFreedom,
      weightedResidualSum,
      unitWeightStdDev: sigma0,
    },
  }
}

function variance(input: { unknowns: string[]; equations: VarianceEquation[]; referenceGroup?: string }) {
  if (input.equations.length <= input.unknowns.length) {
    throw new Error("redundant observations are required for variance component estimation")
  }
  const groups = [...new Set(input.equations.map((equation) => equation.group ?? "default"))]
  if (groups.length < 2) throw new Error("at least two observation groups are required")
  const matrix = input.equations.map((equation) => row(equation, input.unknowns))
  const observed = input.equations.map((equation) => equation.observed)
  const weights = input.equations.map((equation) => equation.weight ?? 1)
  const system = normal({ matrix, observed, weights })
  const values = solve(system.lhs, system.rhs)
  const qxx = inverse(system.lhs)
  const residuals = matrix.map((item, index) => item.reduce((acc, value, j) => acc + value * values[j], 0) - observed[index])
  const redundancy = matrix.map((item, index) => Math.max(0, 1 - weights[index] * quadratic(qxx, item)))
  const components = groups.map((name) => {
    const indexes = input.equations.map((equation, index) => ((equation.group ?? "default") === name ? index : -1)).filter((index) => index >= 0)
    const weightedResidualSum = indexes.reduce((acc, index) => acc + weights[index] * residuals[index] ** 2, 0)
    const redundancySum = indexes.reduce((acc, index) => acc + redundancy[index], 0)
    const varianceFactor = redundancySum > 1e-12 ? weightedResidualSum / redundancySum : undefined
    return {
      name,
      observationCount: indexes.length,
      redundancy: redundancySum,
      weightedResidualSum,
      varianceFactor,
    }
  })
  const reference =
    (input.referenceGroup ? components.find((component) => component.name === input.referenceGroup) : undefined) ??
    components.find((component) => (component.varianceFactor ?? 0) > 0)
  if (input.referenceGroup && !reference) throw new Error(`reference group not found: ${input.referenceGroup}`)
  if (!reference?.varianceFactor || reference.varianceFactor <= 0) throw new Error("reference variance component is not estimable")
  const referenceVariance = reference.varianceFactor
  const weightedResidualSum = residuals.reduce((acc, residual, index) => acc + weights[index] * residual ** 2, 0)
  const degreesOfFreedom = input.equations.length - input.unknowns.length
  return {
    method: "helmert_variance_component_estimation",
    referenceGroup: reference.name,
    unknowns: input.unknowns.map((name, index) => ({
      name,
      value: values[index],
    })),
    residuals: input.equations.map((equation, index) => ({
      name: equation.name ?? `v${index + 1}`,
      group: equation.group ?? "default",
      residual: residuals[index],
      weight: weights[index],
      redundancy: redundancy[index],
    })),
    components: components.map((component) => ({
      name: component.name,
      observationCount: component.observationCount,
      redundancy: component.redundancy,
      weightedResidualSum: component.weightedResidualSum,
      varianceFactor: component.varianceFactor ?? null,
      standardDeviationFactor: component.varianceFactor === undefined ? null : Math.sqrt(Math.max(component.varianceFactor, 0)),
      relativeVarianceFactor:
        component.varianceFactor === undefined ? null : component.varianceFactor / referenceVariance,
      suggestedWeightFactor:
        component.varianceFactor === undefined || component.varianceFactor <= 0
          ? null
          : referenceVariance / component.varianceFactor,
    })),
    statistics: {
      observationCount: input.equations.length,
      unknownCount: input.unknowns.length,
      groupCount: groups.length,
      degreesOfFreedom,
      weightedResidualSum,
      unitWeightStdDev: Math.sqrt(weightedResidualSum / degreesOfFreedom),
      referenceVarianceFactor: referenceVariance,
    },
  }
}

function sigma(input: { residuals: Residual[]; sigma0?: number; degreesOfFreedom?: number }) {
  if (input.sigma0 !== undefined) return input.sigma0
  const sum = input.residuals.reduce((acc, item) => acc + (item.weight ?? 1) * item.residual ** 2, 0)
  return Math.sqrt(sum / (input.degreesOfFreedom ?? Math.max(input.residuals.length - 1, 1)))
}

function gross(input: { residuals: Residual[]; sigma0?: number; degreesOfFreedom?: number; threshold?: number }) {
  const threshold = input.threshold ?? 3
  const unit = sigma(input)
  const tests = input.residuals.map((item, index) => {
    const deviation = item.standardDeviation ?? (unit > 0 ? unit / Math.sqrt(item.weight ?? 1) : undefined)
    const statistic = deviation && deviation > 0 ? Math.abs(item.residual) / deviation : 0
    return {
      name: item.name ?? `v${index + 1}`,
      residual: item.residual,
      weight: item.weight ?? 1,
      standardDeviation: deviation,
      statistic,
      threshold,
      isGrossError: statistic > threshold,
    }
  })
  const grossErrors = tests.filter((item) => item.isGrossError)
  return {
    method: "baarda_standardized_residual",
    sigma0: unit,
    threshold,
    tests,
    grossErrors,
    statistics: {
      observationCount: input.residuals.length,
      grossErrorCount: grossErrors.length,
      maxStatistic: tests.reduce((acc, item) => Math.max(acc, item.statistic), 0),
      threshold,
    },
  }
}

function factor(input: { statistic: number; k0: number; k1: number; floor: number }) {
  const value = Math.abs(input.statistic)
  if (value <= input.k0) return 1
  if (value >= input.k1) return input.floor
  return Math.min(
    1,
    Math.max(input.floor, (input.k0 / value) * ((input.k1 - value) / (input.k1 - input.k0)) ** 2),
  )
}

function weighted(input: { equations: Equation[]; weights: number[] }) {
  return input.equations.map((equation, index) => ({
    ...equation,
    weight: input.weights[index],
  }))
}

function tests(input: { residuals: { name: string; residual: number; weight: number }[]; sigma0: number; base: number[] }) {
  return input.residuals.map((item, index) => {
    const statistic = input.sigma0 > 0 ? Math.abs(item.residual) * Math.sqrt(item.weight) / input.sigma0 : 0
    return {
      name: item.name,
      residual: item.residual,
      baseWeight: input.base[index],
      weight: item.weight,
      weightFactor: item.weight / input.base[index],
      standardizedResidual: statistic,
    }
  })
}

function robust(input: {
  unknowns: string[]
  equations: Equation[]
  k0?: number
  k1?: number
  maxIterations?: number
  tolerance?: number
  minWeightFactor?: number
}) {
  const k0 = input.k0 ?? 1.5
  const k1 = input.k1 ?? 3
  if (k1 <= k0) throw new Error("k1 must be greater than k0")
  const floor = input.minWeightFactor ?? 0.05
  const maxIterations = input.maxIterations ?? 8
  const tolerance = input.tolerance ?? 1e-4
  const base = input.equations.map((equation) => equation.weight ?? 1)
  let weights = base
  let maxWeightChange = 0
  const iterations: { iteration: number; sigma0: number; maxWeightChange: number; downweightedCount: number }[] = []
  for (let index = 0; index < maxIterations; index++) {
    const current = indirect({ unknowns: input.unknowns, equations: weighted({ equations: input.equations, weights }) })
    const rows = tests({
      residuals: current.residuals,
      sigma0: current.statistics.unitWeightStdDev,
      base,
    }).map((item) => ({
      ...item,
      nextWeightFactor: factor({ statistic: item.standardizedResidual, k0, k1, floor }),
    }))
    const next = rows.map((item, i) => base[i] * item.nextWeightFactor)
    maxWeightChange = next.reduce((acc, value, i) => Math.max(acc, Math.abs(value - weights[i])), 0)
    weights = next
    iterations.push({
      iteration: index + 1,
      sigma0: current.statistics.unitWeightStdDev,
      maxWeightChange,
      downweightedCount: rows.filter((item) => item.nextWeightFactor < 1).length,
    })
    if (maxWeightChange <= tolerance) break
  }
  const converged = iterations.some((item) => item.maxWeightChange <= tolerance)
  const result = indirect({ unknowns: input.unknowns, equations: weighted({ equations: input.equations, weights }) })
  const residuals = tests({
    residuals: result.residuals,
    sigma0: result.statistics.unitWeightStdDev,
    base,
  })
  const downweighted = residuals.filter((item) => item.weightFactor < 1 - tolerance)
  return {
    method: "iggiii_robust_adjustment",
    k0,
    k1,
    minWeightFactor: floor,
    tolerance,
    converged: Boolean(converged),
    unknowns: result.unknowns,
    residuals,
    downweighted,
    iterations,
    statistics: {
      ...result.statistics,
      iterationCount: iterations.length,
      downweightedCount: downweighted.length,
      maxWeightChange,
    },
  }
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
    const result = indirect(params)
    return {
      title: "Indirect Adjustment",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})

export const AdjustmentFreeNetworkTool = Tool.define("tool_adjustment_free_network", {
  description: FREE_NETWORK_DESCRIPTION,
  parameters: z.object({
    unknowns: z.array(z.string().min(1)).min(1).max(50).describe("Unknown parameter names in solution order."),
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
      .max(1000),
    constraints: z
      .array(
        z.object({
          name: z.string().optional(),
          coefficients: z.record(z.string(), z.number()).describe("Datum constraint coefficients by unknown name."),
          value: z.number().optional().describe("Right-hand side of the datum constraint. Defaults to 0."),
        }),
      )
      .min(1)
      .max(100)
      .describe("Minimum datum constraints that remove free-network rank defect."),
  }),
  async execute(params) {
    const result = free(params)
    return {
      title: "Free Network Adjustment",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})

export const VarianceComponentTool = Tool.define("tool_variance_component", {
  description: VARIANCE_COMPONENT_DESCRIPTION,
  parameters: z.object({
    unknowns: z.array(z.string().min(1)).min(1).max(50).describe("Unknown parameter names in solution order."),
    equations: z
      .array(
        z.object({
          name: z.string().optional(),
          group: z.string().min(1).optional().describe("Observation type or variance group, e.g. distance, angle, gnss."),
          coefficients: z.record(z.string(), z.number()).describe("Design row coefficients by unknown name."),
          observed: z.number().describe("Observed value on the right-hand side of the equation."),
          weight: z.number().positive().optional().describe("Base observation weight. Defaults to 1."),
        }),
      )
      .min(2)
      .max(1000),
    referenceGroup: z.string().min(1).optional().describe("Optional group used as relative variance reference."),
  }),
  async execute(params) {
    const result = variance(params)
    return {
      title: "Variance Component Estimation",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})

export const AdjustmentRobustTool = Tool.define("tool_adjustment_robust", {
  description: ROBUST_DESCRIPTION,
  parameters: z.object({
    unknowns: z.array(z.string().min(1)).min(1).max(20).describe("Unknown parameter names in solution order."),
    equations: z
      .array(
        z.object({
          name: z.string().optional(),
          coefficients: z.record(z.string(), z.number()).describe("Design row coefficients by unknown name."),
          observed: z.number().describe("Observed value on the right-hand side of the equation."),
          weight: z.number().positive().optional().describe("Base observation weight. Defaults to 1."),
        }),
      )
      .min(1)
      .max(500),
    k0: z.number().positive().optional().describe("IGGIII full-weight threshold. Defaults to 1.5."),
    k1: z.number().positive().optional().describe("IGGIII rejection threshold. Defaults to 3."),
    maxIterations: z.number().int().positive().max(50).optional().describe("Maximum robust iterations. Defaults to 8."),
    tolerance: z.number().positive().optional().describe("Weight convergence tolerance. Defaults to 1e-4."),
    minWeightFactor: z
      .number()
      .positive()
      .max(1)
      .optional()
      .describe("Minimum retained weight factor for severe outliers. Defaults to 0.05."),
  }),
  async execute(params) {
    const result = robust(params)
    return {
      title: "Robust Adjustment",
      output: JSON.stringify(result, null, 2),
      metadata: result.statistics,
    }
  },
})

export const GrossErrorDetectionTool = Tool.define("tool_gross_error_detection", {
  description: GROSS_ERROR_DESCRIPTION,
  parameters: z.object({
    residuals: z
      .array(
        z.object({
          name: z.string().optional(),
          residual: z.number().describe("Adjustment residual."),
          weight: z.number().positive().optional().describe("Observation weight. Defaults to 1."),
          standardDeviation: z.number().positive().optional().describe("Residual standard deviation."),
        }),
      )
      .optional()
      .describe("Residuals from tool_adjustment_indirect."),
    sigma0: z.number().min(0).optional().describe("Unit weight standard deviation from adjustment."),
    degreesOfFreedom: z.number().int().positive().optional().describe("Degrees of freedom for sigma0 estimation."),
    threshold: z.number().positive().optional().describe("Standardized residual threshold. Defaults to 3."),
    unknowns: z.array(z.string().min(1)).min(1).max(20).optional().describe("Unknowns for preliminary adjustment."),
    equations: z
      .array(
        z.object({
          name: z.string().optional(),
          coefficients: z.record(z.string(), z.number()),
          observed: z.number(),
          weight: z.number().positive().optional(),
        }),
      )
      .optional()
      .describe("Equations for preliminary indirect adjustment."),
  }),
  async execute(params) {
    if (params.residuals?.length) {
      const result = gross({
        residuals: params.residuals,
        sigma0: params.sigma0,
        degreesOfFreedom: params.degreesOfFreedom,
        threshold: params.threshold,
      })
      return {
        title: "Gross Error Detection",
        output: JSON.stringify(result, null, 2),
        metadata: result.statistics,
      }
    }
    if (!params.unknowns?.length || !params.equations?.length) {
      throw new Error("residuals or unknowns/equations are required")
    }
    const preliminary = indirect({ unknowns: params.unknowns, equations: params.equations })
    const result = {
      ...gross({
        residuals: preliminary.residuals,
        sigma0: preliminary.statistics.unitWeightStdDev,
        degreesOfFreedom: preliminary.statistics.degreesOfFreedom,
        threshold: params.threshold,
      }),
      preliminary,
    }
    return {
      title: "Gross Error Detection",
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
