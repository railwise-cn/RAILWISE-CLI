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

const SourceFormatSchema = z.enum(["auto", "cosa-in2", "csv", "nasew-dat", "south-in", "lgo-asc", "tbc-csv"])
type SourceFormat = z.infer<typeof SourceFormatSchema>

type Header = {
  kind: "point" | "observation" | "equation"
  columns: Record<string, number>
  names: Record<string, string>
}

const aliases: Record<string, string> = {
  "点名": "name",
  "点号": "pointid",
  "点id": "pointid",
  "点": "point",
  "北坐标": "northing",
  "纵坐标": "northing",
  "北": "northing",
  "东坐标": "easting",
  "横坐标": "easting",
  "东": "easting",
  "测站": "station",
  "起点": "frompoint",
  "源点": "frompoint",
  "目标": "target",
  "照准点": "target",
  "终点": "topoint",
  "观测类型": "type",
  "类型": "type",
  "观测值": "value",
  "观测": "observed",
  "值": "value",
  "右端": "rhs",
  "权": "weight",
  "权重": "weight",
}

function num(value: string | undefined) {
  if (value === undefined) return
  const parsed = Number(value.replace(/^\+/, "").replace(/["']/g, ""))
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
  const value = line.replace(/[，；]/g, ",")
  return value
    .split(/[,\t;]/.test(value) ? /[,\t;]+/ : /[ ]+/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function tag(value: string | undefined) {
  return value?.replace(/^@/, "").replace(/^["']|["']$/g, "").replace(/[:：]$/, "").toLowerCase()
}

function key(value: string | undefined) {
  const valueKey = tag(value)?.replace(/[\s_.-]/g, "")
  return valueKey ? (aliases[valueKey] ?? valueKey) : undefined
}

function has(line: string, patterns: string[]) {
  const value = line.toLowerCase()
  return patterns.some((pattern) => value.includes(pattern))
}

function detect(lines: string[], sourceFormat?: SourceFormat) {
  if (sourceFormat && sourceFormat !== "auto") return sourceFormat
  const text = lines.join("\n")
  if (has(text, ["nasew", "nasew.dat"]) || lines.some((line) => ["nasew", "na"].includes(key(tokens(line)[0]) ?? ""))) {
    return "nasew-dat"
  }
  if (has(text, ["南方", "south"]) || lines.some((line) => ["zd", "gc", "南方平差易"].includes(key(tokens(line)[0]) ?? ""))) {
    return "south-in"
  }
  if (has(text, ["leica", "lgo"]) || lines.some((line) => ["lgo", "leica", "baseline"].includes(key(tokens(line)[0]) ?? ""))) {
    return "lgo-asc"
  }
  if (has(text, ["trimble", " tbc", "point id"]) || lines.some((line) => ["pointid", "frompoint"].includes(key(tokens(line)[0]) ?? ""))) {
    return "tbc-csv"
  }
  if (lines.some((line) => ["unknowns", "equation", "eq"].includes(key(tokens(line)[0]) ?? ""))) return "csv"
  return "cosa-in2"
}

function table(parts: string[]) {
  const pairs = parts.map((part, index) => [key(part) ?? "", index] as const).filter(([name]) => name)
  const columns = Object.fromEntries(pairs)
  const names = Object.fromEntries(parts.map((part) => [key(part) ?? "", part]).filter(([name]) => name))
  const keys = new Set(Object.keys(columns))
  if (
    ["name", "point", "pointid", "id"].some((item) => keys.has(item)) &&
    ["x", "y", "northing", "easting", "n", "e"].some((item) => keys.has(item))
  ) {
    return { kind: "point", columns, names } satisfies Header
  }
  if (
    ["station", "from", "frompoint", "source"].some((item) => keys.has(item)) &&
    ["target", "to", "topoint"].some((item) => keys.has(item)) &&
    ["type", "obs", "observation"].some((item) => keys.has(item))
  ) {
    return { kind: "observation", columns, names } satisfies Header
  }
  if (
    keys.has("observed") ||
    keys.has("rhs") ||
    ((keys.has("l") || keys.has("value")) && (keys.has("name") || keys.has("id")))
  ) {
    return { kind: "equation", columns, names } satisfies Header
  }
}

function field(parts: string[], columns: Record<string, number>, names: string[]) {
  return names.flatMap((name) => {
    const index = columns[name]
    return index === undefined ? [] : [parts[index]]
  })[0]
}

function point(parts: string[], table?: Header) {
  if (table?.kind === "point") {
    const name = field(parts, table.columns, ["name", "point", "pointid", "id"])
    const x = num(field(parts, table.columns, ["x", "northing", "n"]))
    const y = num(field(parts, table.columns, ["y", "easting", "e"]))
    if (name && x !== undefined && y !== undefined) return { name, x, y } satisfies Point
  }
  const first = key(parts[0])
  if (["point", "pt", "p", "coord", "coordinate", "known", "station", "zd"].includes(first ?? "")) {
    const x = num(parts[2])
    const y = num(parts[3])
    if (parts[1] && x !== undefined && y !== undefined) return { name: parts[1], x, y } satisfies Point
  }
  if (parts.length >= 3 && num(parts[0]) === undefined && num(parts[1]) !== undefined && num(parts[2]) !== undefined) {
    return { name: parts[0], x: num(parts[1]) ?? 0, y: num(parts[2]) ?? 0 } satisfies Point
  }
}

function observation(parts: string[], station: string | undefined, table?: Header) {
  if (table?.kind === "observation") {
    const from = field(parts, table.columns, ["station", "from", "frompoint", "source"])
    const to = field(parts, table.columns, ["target", "to", "topoint"])
    const type = field(parts, table.columns, ["type", "obs", "observation"])
    const value = num(field(parts, table.columns, ["value", "observed", "l", "distance", "angle"]))
    const weight = num(field(parts, table.columns, ["weight", "p", "w"]))
    if (from && to && type && value !== undefined) {
      return { station: from, target: to, type: type.toUpperCase(), value, weight } satisfies Observation
    }
  }
  const first = key(parts[0])
  if (["obs", "observation", "measure", "measurement", "m", "gc", "baseline", "vector"].includes(first ?? "")) {
    const value = num(parts[4])
    if (parts[1] && parts[2] && parts[3] && value !== undefined) {
      return {
        station: parts[1],
        target: parts[2],
        type: parts[3].toUpperCase(),
        value,
        weight: num(parts[5]),
      } satisfies Observation
    }
  }
  if (station && parts.length >= 3 && ["l", "s", "direction", "distance", "angle", "azimuth"].includes(key(parts[1]) ?? "")) {
    return {
      station,
      target: parts[0],
      type: parts[1].toUpperCase(),
      value: num(parts[2]) ?? 0,
      weight: num(parts[3]),
    } satisfies Observation
  }
}

function equation(parts: string[], table?: Header) {
  if (table?.kind === "equation") {
    const coefficients: Record<string, number> = {}
    const reserved = new Set(["name", "id", "observed", "rhs", "l", "value", "weight", "p", "w"])
    Object.entries(table.columns).forEach(([name, index]) => {
      if (reserved.has(name)) return
      const value = num(parts[index])
      if (value === undefined) return
      coefficients[parts[index]?.includes("=") ? parts[index].split("=")[0] : (table.names[name] ?? name)] = value
    })
    const observed = num(field(parts, table.columns, ["observed", "rhs", "l", "value"]))
    if (observed === undefined) return
    if (Object.keys(coefficients).length === 0) return
    return {
      name: field(parts, table.columns, ["name", "id"]),
      coefficients,
      observed,
      weight: num(field(parts, table.columns, ["weight", "p", "w"])),
    } satisfies Equation
  }
  const coefficients: Record<string, number> = {}
  const name = parts[1]?.includes("=") ? undefined : parts[1]
  const start = name ? 2 : 1
  const values = Object.fromEntries(
    parts.slice(start).flatMap((part) => {
      const split = part.split("=")
      if (split.length !== 2) return []
      const value = num(split[1])
      if (value === undefined) return []
      const name = key(split[0]) ?? ""
      const mapped = { obs: "observed", rhs: "observed", l: "observed", value: "observed", p: "weight", w: "weight" }[
        name
      ]
      return [[mapped ?? name, value] as const]
    }),
  )
  parts.slice(start).forEach((part) => {
    const split = part.split("=")
    if (split.length !== 2) return
    if (["name", "observed", "obs", "rhs", "l", "value", "weight", "p", "w"].includes(key(split[0]) ?? "")) return
    const value = num(split[1])
    if (value === undefined) return
    coefficients[split[0]] = value
  })
  if (values.observed === undefined) return
  if (Object.keys(coefficients).length === 0) return
  return {
    name: name ?? parts.find((part) => part.startsWith("name="))?.slice("name=".length),
    coefficients,
    observed: values.observed,
    weight: values.weight,
  } satisfies Equation
}

function section(parts: string[]) {
  if (parts.length !== 1) return false
  return [
    "nasew",
    "nasewdat",
    "south",
    "南方平差易",
    "leica",
    "lgo",
    "leicalgo",
    "trimble",
    "tbc",
    "points",
    "observations",
    "measurements",
    "equations",
    "coords",
  ].includes(key(parts[0]) ?? "")
}

function useful(parts: string[]) {
  return parts.some((part) => num(part) !== undefined) || parts.some((part) => part.includes("="))
}

function parse(lines: string[]) {
  const unknowns = [] as string[]
  const equations = [] as Equation[]
  const points = [] as Point[]
  const observations = [] as Observation[]
  const warnings = [] as string[]
  const headerValues =
    lines[0] && tokens(lines[0]).every((part) => num(part) !== undefined) ? tokens(lines[0]).map(Number) : []
  const state = lines.reduce(
    (acc, line, index) => {
      const parts = tokens(line)
      if (section(parts)) return { station: undefined, table: undefined }
      const tableHeader = table(parts)
      if (tableHeader) return { ...acc, table: tableHeader }
      if (["unknowns", "unknown", "unk", "params", "parameters"].includes(key(parts[0]) ?? "")) {
        parts.slice(1).forEach((name) => {
          if (!unknowns.includes(name)) unknowns.push(name)
        })
        return acc
      }
      if (["equation", "eq", "equ", "adj"].includes(key(parts[0]) ?? "") || acc.table?.kind === "equation") {
        const item = equation(parts, acc.table)
        if (item) {
          equations.push(item)
          return acc
        }
        warnings.push(`Line ${index + 1} was skipped because the equation row is incomplete or has no coefficients.`)
        return acc
      }
      const known = point(parts, acc.table)
      if (known) {
        points.push(known)
        return acc
      }
      if (parts.length === 1 && num(parts[0]) === undefined) return { station: parts[0], table: undefined }
      const measured = observation(parts, acc.station, acc.table)
      if (measured) {
        observations.push(measured)
        return acc
      }
      if (useful(parts)) warnings.push(`Line ${index + 1} was skipped because it did not match a supported point, observation, or equation row.`)
      return acc
    },
    { station: undefined as string | undefined, table: undefined as Header | undefined },
  )
  if (!state.station && observations.length === 0 && points.length === 0 && equations.length === 0) {
    warnings.push("No supported survey observations or normalized equations were detected.")
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
    header: headerValues,
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
    sourceFormat: SourceFormatSchema.optional().describe("Source format. Defaults to auto."),
    targetFormat: z
      .enum(["adjustment-indirect"])
      .optional()
      .describe("Target RAILWISE tool payload. Defaults to adjustment-indirect."),
  }),
  async execute(params) {
    const input = await source(params)
    const lines = clean(input.content)
    const detectedFormat = detect(lines, params.sourceFormat)
    const result = parse(lines)
    return {
      title: "Format Converter",
      output: JSON.stringify(
        {
          sourcePath: input.path,
          sourceFormat: params.sourceFormat ?? "auto",
          detectedFormat,
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
