import { describe, test, expect, afterEach } from "bun:test"
import { unlink } from "node:fs/promises"
import path from "path"
import tool from "./chart_generator"

const run = async (args: any) => JSON.parse(await tool.execute(args))

const TMP = path.join(import.meta.dir, "__test_tmp__")
const outputs: string[] = []

afterEach(async () => {
  for (const f of outputs) await unlink(f).catch(() => {})
  outputs.length = 0
})

function outPath(name: string) {
  const p = path.join(TMP, name)
  outputs.push(p)
  return p
}

// ============================================================
// 基本 SVG 生成
// ============================================================
describe("chart_generator - SVG 生成", () => {
  test("单测点趋势图", async () => {
    const dest = outPath("single.svg")
    const r = await run({
      data: [
        { point_id: "JC-01", date: "2024-01-01", value: 0 },
        { point_id: "JC-01", date: "2024-01-02", value: -1.2 },
        { point_id: "JC-01", date: "2024-01-03", value: -2.5 },
        { point_id: "JC-01", date: "2024-01-04", value: -3.1 },
      ],
      title: "地表沉降监测趋势图",
      outputPath: dest,
    })

    expect(r.series_count).toBe(1)
    expect(r.point_count).toBe(4)
    expect(r.message).toContain("趋势图已生成")

    const svg = await Bun.file(dest).text()
    expect(svg).toContain("<svg")
    expect(svg).toContain("地表沉降监测趋势图")
    expect(svg).toContain("JC-01")
  })

  test("多测点趋势图", async () => {
    const dest = outPath("multi.svg")
    const data = []
    for (const id of ["JC-01", "JC-02", "JC-03"]) {
      for (let i = 0; i < 5; i++) {
        data.push({
          point_id: id,
          date: `2024-01-${String(i + 1).padStart(2, "0")}`,
          value: -i * (id === "JC-01" ? 1 : id === "JC-02" ? 0.5 : 1.5),
        })
      }
    }

    const r = await run({ data, outputPath: dest })

    expect(r.series_count).toBe(3)
    expect(r.point_count).toBe(15)

    const svg = await Bun.file(dest).text()
    expect(svg).toContain("JC-01")
    expect(svg).toContain("JC-02")
    expect(svg).toContain("JC-03")
    // 应有 3 条 polyline
    expect((svg.match(/<polyline/g) ?? []).length).toBe(3)
  })
})

// ============================================================
// 报警线叠加
// ============================================================
describe("chart_generator - 报警线", () => {
  test("报警阈值线绘制", async () => {
    const dest = outPath("alert.svg")
    const r = await run({
      data: [
        { point_id: "JC-01", date: "2024-01-01", value: -5 },
        { point_id: "JC-01", date: "2024-01-02", value: -15 },
        { point_id: "JC-01", date: "2024-01-03", value: -25 },
      ],
      alertThreshold: -20,
      outputPath: dest,
    })

    const svg = await Bun.file(dest).text()
    expect(svg).toContain("报警值")
    expect(svg).toContain("-20")
    // 红色虚线
    expect(svg).toContain("#ef4444")
    expect(svg).toContain("stroke-dasharray")
  })

  test("不传阈值不绘制报警线", async () => {
    const dest = outPath("no_alert.svg")
    await run({
      data: [
        { point_id: "JC-01", date: "2024-01-01", value: 0 },
        { point_id: "JC-01", date: "2024-01-02", value: -5 },
      ],
      outputPath: dest,
    })

    const svg = await Bun.file(dest).text()
    expect(svg).not.toContain("报警值")
  })
})

// ============================================================
// 文件输出
// ============================================================
describe("chart_generator - 文件输出", () => {
  test("输出到指定路径", async () => {
    const dest = outPath("custom_path.svg")
    await run({
      data: [{ point_id: "P1", date: "2024-01-01", value: 0 }],
      outputPath: dest,
    })

    expect(await Bun.file(dest).exists()).toBe(true)
  })

  test("日期范围正确", async () => {
    const dest = outPath("range.svg")
    const r = await run({
      data: [
        { point_id: "P1", date: "2024-01-01", value: 0 },
        { point_id: "P1", date: "2024-03-15", value: -10 },
      ],
      outputPath: dest,
    })

    expect(r.date_range).toBe("2024-01-01 ~ 2024-03-15")
  })

  test("SVG 尺寸正确", async () => {
    const dest = outPath("size.svg")
    const r = await run({
      data: [{ point_id: "P1", date: "2024-01-01", value: 0 }],
      outputPath: dest,
    })

    expect(r.width).toBe(800)
    expect(r.height).toBe(400)
  })
})
