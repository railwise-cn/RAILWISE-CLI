import { expect, test } from "bun:test"
import path from "path"
import { Instance } from "../../src/project/instance"
import { AdjustmentIndirectTool } from "../../src/tool/adjustment"
import { FormatConverterTool } from "../../src/tool/format"
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
      await Bun.write(
        path.join(dir, "cpiii.in2"),
        [
          "3.5,5,5",
          "CP300,4003.855,2903.360",
          "CP301,4094.969,3854.515",
          "CP300",
          "CP301,L,0",
          "CP301,S,339.366",
          "unknowns,dN_CP301,dE_CP301",
          "equation,baseline_north,dN_CP301=1,observed=0.002,weight=1",
          "equation,baseline_east,dE_CP301=1,observed=-0.001,weight=1",
          "equation,closure_vector,dN_CP301=1,dE_CP301=1,observed=0.0005,weight=0.8",
          "",
        ].join("\n"),
      )
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
      }

      expect(converted.points.map((point) => point.name)).toEqual(["CP300", "CP301"])
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
  const cases = [
    {
      sourceFormat: "nasew-dat",
      content: [
        "NASEW DAT",
        "P CP300 4003.855 2903.360",
        "OBS CP300 CP301 DIST 339.366 1",
        "UNK dN_CP301 dE_CP301",
        "EQ baseline_north dN_CP301=1 observed=0.002 weight=1",
        "EQ baseline_east dE_CP301=1 observed=-0.001 weight=1",
      ].join("\n"),
      unknowns: ["dN_CP301", "dE_CP301"],
    },
    {
      sourceFormat: "south-in",
      content: [
        "南方平差易",
        "ZD CP300 4003.855 2903.360",
        "GC CP300 CP301 S 339.366 1",
        "PARAMS dN_CP301 dE_CP301",
        "EQU baseline_north dN_CP301=1 L=0.002 P=1",
        "EQU baseline_east dE_CP301=1 L=-0.001 P=1",
      ].join("\n"),
      unknowns: ["dN_CP301", "dE_CP301"],
    },
    {
      sourceFormat: "lgo-asc",
      content: [
        "LEICA LGO",
        "POINT CP300 4003.855 2903.360",
        "BASELINE CP300 CP301 GNSS 0.002 1",
        "UNKNOWN dN_CP301",
        "ADJ baseline_north dN_CP301=1 RHS=0.002 W=1",
      ].join("\n"),
      unknowns: ["dN_CP301"],
    },
    {
      sourceFormat: "tbc-csv",
      content: [
        "Point ID,Northing,Easting",
        "CP300,4003.855,2903.360",
        "From Point,To Point,Type,Value,Weight",
        "CP300,CP301,DIST,339.366,1",
        "Name,dN_CP301,Observed,Weight",
        "baseline_north,1,0.002,1",
      ].join("\n"),
      unknowns: ["dN_CP301"],
    },
  ] as const

  await Promise.all(
    cases.map(async (item) => {
      const converted = JSON.parse((await tool.execute({ content: item.content, sourceFormat: "auto" }, ctx())).output) as {
        detectedFormat: string
        points: { name: string }[]
        observations: { station: string; target: string; type: string; value: number }[]
        next: { tool: "tool_adjustment_indirect"; args: { unknowns: string[]; equations: unknown[] } }
      }

      expect(converted.detectedFormat).toBe(item.sourceFormat)
      expect(converted.points.map((point) => point.name)).toContain("CP300")
      expect(converted.observations[0]?.station).toBe("CP300")
      expect(converted.next.tool).toBe("tool_adjustment_indirect")
      expect(converted.next.args.unknowns).toEqual([...item.unknowns])
      expect(converted.next.args.equations.length).toBeGreaterThan(0)
    }),
  )
})
