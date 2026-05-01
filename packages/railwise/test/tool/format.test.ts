import { expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { AdjustmentIndirectTool } from "../../src/tool/adjustment"
import { FormatConverterTool } from "../../src/tool/format"
import { FormatSamples } from "../../src/tool/format-samples"
import { tmpdir } from "../fixture/fixture"

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

test("format converter turns COSA in2 sample into indirect adjustment payload", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(path.join(dir, "cpiii.in2"), FormatSamples.get("cosa-in2").content)
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const tool = await FormatConverterTool.init()
      const converted = JSON.parse(
        (await tool.execute({ inputPath: "cpiii.in2", sourceFormat: "cosa-in2" }, ctx())).output,
      ) as {
        points: { name: string }[]
        observations: { station: string; target: string; type: string; value: number }[]
        next: {
          tool: "tool_adjustment_indirect"
          args: {
            unknowns: string[]
            equations: { name?: string; coefficients: Record<string, number>; observed: number; weight?: number }[]
          }
        }
        warnings: string[]
      }

      expect(converted.points.map((point) => point.name)).toEqual(["CP300", "CP301"])
      expect(converted.warnings).toEqual([])
      expect(converted.observations).toContainEqual({ station: "CP300", target: "CP301", type: "S", value: 339.366 })
      expect(converted.next.tool).toBe("tool_adjustment_indirect")
      expect(converted.next.args.unknowns).toEqual(["dN_CP301", "dE_CP301"])

      const adjustment = await AdjustmentIndirectTool.init()
      const adjusted = JSON.parse((await adjustment.execute(converted.next.args, ctx())).output) as {
        statistics: { unitWeightStdDev: number }
      }

      expect(adjusted.statistics.unitWeightStdDev).toBeCloseTo(0.0002773501, 9)
    },
  })
})

test("format converter recognizes M9 vendor format variants", async () => {
  const tool = await FormatConverterTool.init()
  const cases = FormatSamples.list.filter((item) => item.id !== "cosa-in2" && !("damaged" in item && item.damaged))

  await Promise.all(
    cases.map(async (item) => {
      const converted = JSON.parse(
        (await tool.execute({ content: item.content, sourceFormat: "auto" }, ctx())).output,
      ) as {
        detectedFormat: string
        points: { name: string }[]
        observations: { station: string; target: string; type: string; value: number }[]
        next: { tool: "tool_adjustment_indirect"; args: { unknowns: string[]; equations: unknown[] } }
      }

      expect(converted.detectedFormat).toBe(item.expectedFormat)
      expect(converted.points.map((point) => point.name)).toContain("CP300")
      expect(converted.observations[0]?.station).toBe("CP300")
      expect(converted.next.tool).toBe("tool_adjustment_indirect")
      expect(converted.next.args.unknowns).toEqual([...item.unknowns])
      expect(converted.next.args.equations.length).toBeGreaterThan(0)
    }),
  )
})

test("format converter keeps usable rows and warns on damaged real-world rows", async () => {
  const tool = await FormatConverterTool.init()
  const sample = FormatSamples.get("south-damaged")
  const converted = JSON.parse(
    (
      await tool.execute(
        {
          sourceFormat: "auto",
          content: sample.content,
        },
        ctx(),
      )
    ).output,
  ) as {
    detectedFormat: string
    points: { name: string; x: number; y: number }[]
    observations: { station: string; target: string; type: string; value: number; weight?: number }[]
    warnings: string[]
    next: {
      args: {
        unknowns: string[]
        equations: { name?: string; coefficients: Record<string, number>; observed: number; weight?: number }[]
      }
    }
  }

  expect(converted.detectedFormat).toBe("south-in")
  expect(converted.points).toContainEqual({ name: "CP300", x: 4003.855, y: 2903.36 })
  expect(converted.observations).toContainEqual({
    station: "CP300",
    target: "CP301",
    type: "S",
    value: 339.366,
    weight: 1,
  })
  expect(converted.next.args.unknowns).toEqual(["dN_CP301"])
  expect(converted.next.args.equations[0]).toEqual({
    name: "baseline_north",
    coefficients: { dN_CP301: 1 },
    observed: 0.002,
    weight: 1,
  })
  expect(converted.warnings.some((item) => item.includes("Line 6"))).toBe(true)
  expect(converted.warnings.some((item) => item.includes("Line 7"))).toBe(true)
})

test("format converter sample corpus is fully ready", async () => {
  const tool = await FormatConverterTool.init()
  const ids = FormatSamples.list.map((sample) => sample.id)

  expect(ids).toEqual(["cosa-in2", "nasew-dat", "south-in", "lgo-asc", "tbc-csv", "south-damaged"])
  expect(new Set(ids).size).toBe(FormatSamples.list.length)
  expect(FormatSamples.list.every((sample) => sample.label.length > 0)).toBe(true)
  expect(FormatSamples.list.every((sample) => sample.content.trim().split("\n").length >= 5)).toBe(true)

  const results = await Promise.all(
    FormatSamples.list.map(async (sample) => {
      const converted = JSON.parse(
        (await tool.execute({ sourceFormat: sample.sourceFormat, content: sample.content }, ctx())).output,
      ) as {
        detectedFormat: string
        warnings: string[]
        next?: { tool: string; args: { unknowns: string[]; equations: unknown[] } }
      }
      return { sample, converted }
    }),
  )

  expect(results.map((item) => item.converted.detectedFormat)).toEqual(
    FormatSamples.list.map((sample) => sample.expectedFormat),
  )
  expect(results.every((item) => item.converted.next)).toBe(true)
  expect(results.every((item) => item.converted.next?.tool === "tool_adjustment_indirect")).toBe(true)
  expect(results.map((item) => item.converted.next?.args.unknowns)).toEqual(
    FormatSamples.list.map((sample) => [...sample.unknowns]),
  )
  expect(results.every((item) => (item.converted.next?.args.equations.length ?? 0) > 0)).toBe(true)
  expect(results.map((item) => item.converted.warnings.length)).toEqual(
    FormatSamples.list.map((sample) => sample.expectedWarnings),
  )
  expect(new Set(results.map((item) => item.converted.detectedFormat)).size).toBe(5)
  expect(results.flatMap((item) => item.converted.warnings).length).toBe(2)
})
