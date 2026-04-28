import { expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { NormCiteTool, WikiIndexTool, WikiIngestTool, WikiLintTool, WikiQueryTool } from "../../src/tool/wiki"
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
        hits: {
          citations: { norm: string; clause: string }[]
          citationTriples: { wiki_page_path: string; raw_source_md?: string; norm_clause_id: string }[]
        }[]
      }

      expect(data.hits[0]?.citations[0]).toEqual({ norm: "TB10101-2018", clause: "5.4.3" })
      expect(data.hits[0]?.citationTriples[0]?.raw_source_md).toBe("raw/TB10101-2018/tb10101-demo.md")

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

test("wiki maintenance tools ingest, index, and lint project wiki", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      const raw = path.join(dir, ".railwise", "norm-library", "raw", "TB10101-2018")
      await fs.mkdir(raw, { recursive: true })
      await Bun.write(
        path.join(raw, "tb10101-extra.md"),
        [
          "# CPIII 复测坐标较差",
          "",
          "CPIII 复测坐标较差应在项目技术要求中复核。",
          "",
          "Reference: TB10101-2018, clause 6.2.1",
          "",
        ].join("\n"),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const ingest = await WikiIngestTool.init()
      const result = JSON.parse((await ingest.execute({ rawPath: "raw/TB10101-2018/tb10101-extra.md" }, ctx())).output) as {
        pages: string[]
      }
      expect(result.pages).toEqual(["wiki/clauses/tb10101-2018-6-2-1.md"])

      const index = await WikiIndexTool.init()
      const indexed = JSON.parse((await index.execute({}, ctx())).output) as { pageCount: number; rawCount: number }
      expect(indexed.pageCount).toBe(1)
      expect(indexed.rawCount).toBe(1)

      const lint = await WikiLintTool.init()
      const report = JSON.parse((await lint.execute({}, ctx())).output) as {
        ok: boolean
        problemCount: number
        problems: unknown[]
      }
      expect(report).toEqual({ ok: true, problemCount: 0, problems: [] })
    },
  })
})
