import { expect, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { NormCiteTool, WikiQueryTool } from "../../src/tool/wiki"
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

test("wiki tools query pages and format citations", async () => {
  await using tmp = await tmpdir()
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const query = await WikiQueryTool.init()
      const result = await query.execute({ query: "CPIII 相邻点相对点位中误差" }, ctx())
      const data = JSON.parse(result.output) as {
        hits: { citations: { norm: string; clause: string }[] }[]
      }

      expect(data.hits[0]?.citations[0]).toEqual({ norm: "TB10101-2018", clause: "5.4.3" })

      const cite = await NormCiteTool.init()
      expect(
        (
          await cite.execute(
            {
              norm: "TB10101-2018",
              clause: "5.4.3",
              text: "CPIII 相邻点相对点位中误差不得超过 1 mm。",
            },
            ctx(),
          )
        ).output,
      ).toBe("参照 TB10101-2018 第 5.4.3 条，CPIII 相邻点相对点位中误差不得超过 1 mm。")
    },
  })
})
