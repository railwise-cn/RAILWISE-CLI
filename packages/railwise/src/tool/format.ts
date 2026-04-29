import path from "path"
import z from "zod"
import { Instance } from "../project/instance"
import { Tool } from "./tool"

import DESCRIPTION from "./format-converter.txt"

type Equation = {
  name?: string
  coefficients: Record<string, number>
  observed: number
  weight?: number
}

type Point = {
  name: string
  x: number
  y: number
}

type Observation = {
  station: string
  target: string
  type: string
  value: number
  weight?: number
}

function num(value: string | undefined) {
  if (value === undefined) return
  const parsed = Number(value)
  if (Number.isFinite(parsed)) return parsed
}

function clean(content: string) {
  return content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && !line.startsWith("//"))
}

function tokens(line: string) {
  return line
    .split(/[,\t]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function tag(value: string | undefined) {
  return value?.replace(/^@/, "").toLowerCase()
}

function equation(parts: string[]) {
  const coefficients: Record<string, number> = {}
  const name = parts[1]?.includes("=") ? undefined : parts[1]
  const start = name ? 2 : 1
  const values = Object.fromEntries(
    parts.slice(start).flatMap((part) => {
      const split = part.split("=")
      if (split.length !== 2) return []
      const value = num(split[1])
      if (value === undefined) return []
      return [[split[0].toLowerCase(), value] as const]
    }),
  )
  parts.slice(start).forEach((part) => {
    const split = part.split("=")
    if (split.length !== 2) return
    if (["name", "observed", "weight"].includes(split[0].toLowerCase())) return
    const value = num(split[1])
    if (value === undefined) return
    coefficients[split[0]] = value
  })
  if (values.observed === undefined) return
  return {
    name: name ?? parts.find((part) => part.startsWith("name="))?.slice("name=".length),
    coefficients,
    observed: values.observed,
    weight: values.weight,
  } satisfies Equation
}

function parse(lines: string[]) {
  const unknowns = [] as string[]
  const equations = [] as Equation[]
  const points = [] as Point[]
  const observations = [] as Observation[]
  const warnings = [] as string[]
  const header = lines[0] && tokens(lines[0]).every((part) => num(part) !== undefined) ? tokens(lines[0]).map(Number) : []
  const stations = lines.reduce(
    (acc, line) => {
      const parts = tokens(line)
      const first = tag(parts[0])
      if (first === "unknowns") {
        parts.slice(1).forEach((name) => {
          if (!unknowns.includes(name)) unknowns.push(name)
        })
        return acc
      }
      if (first === "equation" || first === "eq") {
        const item = equation(parts)
        if (item) equations.push(item)
        return acc
      }
      if (parts.length >= 3 && num(parts[0]) === undefined && num(parts[1]) !== undefined && num(parts[2]) !== undefined) {
        points.push({ name: parts[0], x: num(parts[1]) ?? 0, y: num(parts[2]) ?? 0 })
        return acc
      }
      if (parts.length === 1 && num(parts[0]) === undefined) return parts[0]
      if (acc && parts.length >= 3 && ["l", "s", "direction", "distance"].includes(tag(parts[1]) ?? "")) {
        observations.push({
          station: acc,
          target: parts[0],
          type: parts[1].toUpperCase(),
          value: num(parts[2]) ?? 0,
          weight: num(parts[3]),
        })
      }
      return acc
    },
    undefined as string | undefined,
  )
  if (!stations && observations.length === 0 && points.length === 0 && equations.length === 0) {
    warnings.push("No COSA station observations or normalized equations were detected.")
  }
  if (!unknowns.length) {
    equations
      .flatMap((item) => Object.keys(item.coefficients))
      .forEach((name) => {
        if (!unknowns.includes(name)) unknowns.push(name)
      })
  }
  if (!equations.length && observations.length) {
    warnings.push("Raw COSA station observations were parsed, but linear adjustment equations were not present.")
  }
  return {
    header,
    points,
    observations,
    adjustment: equations.length ? { unknowns, equations } : undefined,
    warnings,
  }
}

async function source(params: { inputPath?: string; content?: string }) {
  if (params.content) return { content: params.content, path: undefined }
  if (!params.inputPath) throw new Error("inputPath or content is required")
  const root = Instance.worktree === "/" ? Instance.directory : Instance.worktree
  const file = path.isAbsolute(params.inputPath) ? params.inputPath : path.join(root, params.inputPath)
  return { content: await Bun.file(file).text(), path: file }
}

export const FormatConverterTool = Tool.define("tool_format_converter", {
  description: DESCRIPTION,
  parameters: z.object({
    inputPath: z.string().optional().describe("Source survey file path, relative to the worktree or absolute."),
    content: z.string().optional().describe("Inline survey file content. Use this for small pasted .in2/.csv snippets."),
    sourceFormat: z.enum(["auto", "cosa-in2", "csv"]).optional().describe("Source format. Defaults to auto."),
    targetFormat: z
      .enum(["adjustment-indirect"])
      .optional()
      .describe("Target RAILWISE tool payload. Defaults to adjustment-indirect."),
  }),
  async execute(params) {
    const input = await source(params)
    const lines = clean(input.content)
    const result = parse(lines)
    return {
      title: "Format Converter",
      output: JSON.stringify(
        {
          sourcePath: input.path,
          sourceFormat: params.sourceFormat ?? "auto",
          targetFormat: params.targetFormat ?? "adjustment-indirect",
          lineCount: lines.length,
          ...result,
          next: result.adjustment
            ? {
                tool: "tool_adjustment_indirect",
                args: result.adjustment,
              }
            : undefined,
        },
        null,
        2,
      ),
      metadata: {
        sourcePath: input.path,
        pointCount: result.points.length,
        observationCount: result.observations.length,
        equationCount: result.adjustment?.equations.length ?? 0,
        ready: result.adjustment !== undefined,
      },
    }
  },
})
