/// <reference path="../env.d.ts" />
import { describe, expect, test, afterAll } from "bun:test"
import { unlink } from "node:fs/promises"
import report_export from "./report_export"

const ctx: any = { sessionID: "", messageID: "", agent: "", directory: "", worktree: "", abort: new AbortController().signal, metadata() {}, ask: async () => {} }

function parse(json: string) {
  return JSON.parse(json)
}

const TMP_DIR = ".railwise/tool/__test_tmp__"
const cleanup: string[] = []

afterAll(async () => {
  for (const f of cleanup) await unlink(f).catch(() => {})
})

describe("report_export", () => {
  test("generates valid .docx from simple markdown", async () => {
    const dest = `${TMP_DIR}/simple_report.docx`
    cleanup.push(dest)
    const md = "# 测试报告\n\n本日监测正常。\n\n## 数据汇总\n\n- 测点A：0.5mm\n- 测点B：0.3mm\n"
    const r = parse(await report_export.execute({ markdown: md, title: "测试报告", outputPath: dest }, ctx))
    expect(r.output_path).toBe(dest)
    expect(r.file_size_kb).toBeGreaterThan(0)
    expect(r.content_stats.headings).toBe(2)
    expect(r.content_stats.lists).toBe(2)

    const file = Bun.file(dest)
    expect(await file.exists()).toBe(true)
    const bytes = new Uint8Array(await file.arrayBuffer())
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
  })

  test("handles bold text and numbered lists", async () => {
    const dest = `${TMP_DIR}/formatted_report.docx`
    cleanup.push(dest)
    const md = "# 标题\n\n**加粗文本**和普通文本\n\n1. 第一项\n2. 第二项\n"
    const r = parse(await report_export.execute({ markdown: md, title: "格式测试", outputPath: dest }, ctx))
    expect(r.content_stats.headings).toBe(1)
    expect(await Bun.file(dest).exists()).toBe(true)
  })

  test("handles blockquotes and horizontal rules", async () => {
    const dest = `${TMP_DIR}/quote_report.docx`
    cleanup.push(dest)
    const md = "> 本日无预警情况。\n\n---\n\n正常段落\n"
    const r = parse(await report_export.execute({ markdown: md, title: "引用测试", outputPath: dest }, ctx))
    expect(r.file_size_kb).toBeGreaterThan(0)
  })

  test("uses title as default filename when no outputPath", async () => {
    const r = parse(await report_export.execute({ markdown: "# Hello\n\nWorld", title: "月度监测报告" }, ctx))
    cleanup.push(r.output_path)
    expect(r.output_path).toContain("月度监测报告")
    expect(r.output_path).toEndWith(".docx")
    expect(await Bun.file(r.output_path).exists()).toBe(true)
  })

  test("handles empty markdown", async () => {
    const dest = `${TMP_DIR}/empty_report.docx`
    cleanup.push(dest)
    const r = parse(await report_export.execute({ markdown: "", title: "空报告", outputPath: dest }, ctx))
    expect(r.file_size_kb).toBeGreaterThan(0)
    expect(await Bun.file(dest).exists()).toBe(true)
  })

  test("handles special XML characters in content", async () => {
    const dest = `${TMP_DIR}/special_chars.docx`
    cleanup.push(dest)
    const md = "# 数据 <报告> & \"分析\"\n\n值 > 30mm 且 < 50mm\n"
    const r = parse(await report_export.execute({ markdown: md, title: "特殊字符", outputPath: dest }, ctx))
    expect(r.file_size_kb).toBeGreaterThan(0)
    expect(await Bun.file(dest).exists()).toBe(true)
  })

  test("large report with multiple heading levels", async () => {
    const dest = `${TMP_DIR}/large_report.docx`
    cleanup.push(dest)
    const sections = Array.from({ length: 5 }, (_, i) =>
      `## ${i + 1}. 监测项目${i + 1}\n\n### ${i + 1}.1 数据分析\n\n本期变化量为 ${(i * 0.3).toFixed(1)}mm。\n`
    ).join("\n")
    const md = `# 某地铁保护区监测月报\n\n${sections}`
    const r = parse(await report_export.execute({ markdown: md, title: "大型报告", outputPath: dest }, ctx))
    expect(r.content_stats.headings).toBe(11)
    expect(r.file_size_kb).toBeGreaterThan(1)
  })
})
