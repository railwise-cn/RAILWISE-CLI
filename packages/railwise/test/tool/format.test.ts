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
