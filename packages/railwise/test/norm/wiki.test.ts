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

  test("ingests raw markdown into wiki pages and lints the result", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const raw = path.join(dir, ".railwise", "norm-library", "raw", "GB50497-2019")
        await fs.mkdir(raw, { recursive: true })
        await Bun.write(
          path.join(raw, "gb50497-demo.md"),
          [
            "# 基坑监测报警阈值",
            "",
            "监测报警值应按设计文件和监测方案确定。",
            "",
            "Reference: GB50497-2019, clause 8.0.7",
            "",
          ].join("\n"),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const result = await NormWiki.ingest({ rawPath: "raw/GB50497-2019/gb50497-demo.md" })
        expect(result.pages).toEqual(["wiki/clauses/gb50497-2019-8-0-7.md"])

        const hits = await NormWiki.query({ query: "基坑监测报警阈值" })
        expect(hits[0]?.sourceRaw).toBe("raw/GB50497-2019/gb50497-demo.md")
        expect(hits[0]?.normClauseId).toBe("GB50497-2019 8.0.7")

        const root = path.join(tmp.path, ".railwise", "norm-library")
        expect(await Bun.file(path.join(root, "wiki", "index.md")).text()).toContain("clauses/gb50497-2019-8-0-7.md")
        expect(await Bun.file(path.join(root, "wiki", "log.md")).text()).toContain("ingest | 基坑监测报警阈值")
        expect(await NormWiki.lint()).toEqual({ ok: true, problemCount: 0, problems: [] })
      },
    })
  })

  test("lint reports conflicts, projected links, stale pages, and orphans", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const root = path.join(dir, ".railwise", "norm-library")
        const raw = path.join(root, "raw", "TB10101-2018")
        const wiki = path.join(root, "wiki", "clauses")
        await fs.mkdir(raw, { recursive: true })
        await fs.mkdir(wiki, { recursive: true })
        await Bun.write(path.join(raw, "a.md"), "# Raw A\n")
        await Bun.write(path.join(raw, "b.md"), "# Raw B\n")
        await Bun.write(
          path.join(wiki, "page-a.md"),
          [
            "---",
            "source_raw: raw/TB10101-2018/a.md",
            "norm_clause_id: TB10101-2018 5.4.3",
            "---",
            "",
            "# CPIII 精度 A",
            "",
            "参照 TB10101-2018 第 5.4.3 条，CPIII 相邻点相对点位中误差不得超过 1 mm。",
            "",
            "See [CPIII 精度 B](page-b.md) and [[未建术语页]].",
            "",
          ].join("\n"),
        )
        await Bun.write(
          path.join(wiki, "page-b.md"),
          [
            "---",
            "source_raw: raw/TB10101-2018/b.md",
            "norm_clause_id: TB10101-2018 5.4.3",
            "supersededBy: wiki/clauses/page-c.md",
            "---",
            "",
            "# CPIII 精度 B",
            "",
            "参照 TB10101-2018 第 5.4.3 条，CPIII 相邻点相对点位中误差不得超过 2 mm。",
            "",
          ].join("\n"),
        )
        await Bun.write(
          path.join(root, "wiki", "index.md"),
          ["# Index", "", "- clauses/page-a.md", "- clauses/page-b.md", ""].join("\n"),
        )
      },
    })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const report = await NormWiki.lint({ writeReport: true })
        const types = report.problems.map((problem) => problem.type)

        expect(report.ok).toBe(false)
        expect(report.reportPath).toBe(`wiki/changes/lint-${new Date().toISOString().slice(0, 10)}.md`)
        expect(types).toContain("conflict")
        expect(types).toContain("projected_page")
        expect(types).toContain("stale_page")
        expect(types).toContain("orphan_page")
        const written = await Bun.file(path.join(tmp.path, ".railwise", "norm-library", report.reportPath!)).text()
        expect(written).toContain("# RAILWISE Norm Wiki Lint Report")
        expect(written).toContain("projected_page")
        expect(written).toContain("conflict")
      },
    })
  })

  test("formats mandatory citation", () => {
    expect(NormWiki.cite({ norm: "TB10101-2018", clause: "5.4.3", text: "CPIII 相邻点限差为 1 mm。" })).toBe(
      "参照 TB10101-2018 第 5.4.3 条，CPIII 相邻点限差为 1 mm。",
    )
  })
})
