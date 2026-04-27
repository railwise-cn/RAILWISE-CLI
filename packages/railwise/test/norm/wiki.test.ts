import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { NormWiki } from "../../src/norm/wiki"

describe("norm wiki", () => {
  test("queries bundled demo pages with citations", async () => {
    await using tmp = await tmpdir()
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hits = await NormWiki.query({ query: "CPIII 相邻点相对点位中误差限差是多少" })
        expect(hits[0]?.path).toBe("wiki/clauses/cpiii-precision.md")
        expect(hits[0]?.citations[0]).toEqual({ norm: "TB10101-2018", clause: "5.4.3" })
      },
    })
  })

  test("uses project norm library and appends query log", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const wiki = path.join(dir, ".railwise", "norm-library", "wiki", "clauses")
        await fs.mkdir(wiki, { recursive: true })
        await Bun.write(
          path.join(wiki, "gb50497-threshold.md"),
          [
            "# 基坑监测报警阈值",
            "",
            "基坑监测报警阈值需要结合设计文件与地方要求复核。",
            "",
            "参照 GB50497-2019 第 8.0.7 条，监测报警值应按设计文件和监测方案确定。",
            "",
          ].join("\n"),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const hits = await NormWiki.query({ query: "基坑监测报警阈值" })
        expect(hits).toHaveLength(1)
        expect(await NormWiki.appendLog({ query: "基坑监测报警阈值", hits })).toBe(true)
        expect(await Bun.file(path.join(tmp.path, ".railwise", "norm-library", "wiki", "log.md")).text()).toContain(
          "基坑监测报警阈值",
        )
      },
    })
  })

  test("formats mandatory citation", () => {
    expect(NormWiki.cite({ norm: "TB10101-2018", clause: "5.4.3", text: "CPIII 相邻点限差为 1 mm。" })).toBe(
      "参照 TB10101-2018 第 5.4.3 条，CPIII 相邻点限差为 1 mm。",
    )
  })
})
