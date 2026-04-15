import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { unlink } from "node:fs/promises"
import path from "path"
import tool from "./format_parser"

const run = async (args: any) => JSON.parse(await tool.execute(args))

const TMP = path.join(import.meta.dir, "__test_tmp__")

async function writeTmp(name: string, content: string) {
  const p = path.join(TMP, name)
  await Bun.write(p, content)
  return p
}

beforeEach(async () => {
  await Bun.write(path.join(TMP, ".keep"), "")
})

afterEach(async () => {
  const glob = new Bun.Glob("*")
  for await (const f of glob.scan({ cwd: TMP, absolute: true })) {
    if (!f.endsWith(".keep")) await unlink(f).catch(() => {})
  }
})

// ============================================================
// GSI-8 格式
// ============================================================
describe("format_parser - GSI-8", () => {
  test("解析标准 GSI-8 行", async () => {
    // GSI-8: 8字符数据域
    // 11 = 点号, 21 = 水平角, 22 = 竖直角, 31 = 斜距
    const gsi = [
      "*110001+00000001 21.002+03501234 22.002+08912345 31.000+00125340",
      "*110002+00000002 21.002+09012345 22.002+08823456 31.000+00098760",
    ].join("\n")
    const p = await writeTmp("test.gsi", gsi)
    const r = await run({ filePath: p, format: "gsi-8" })

    expect(r.format).toBe("gsi-8")
    expect(r.total_records).toBe(2)
    expect(r.records[0].point_id).toBe("1")
    expect(r.records[0]).toHaveProperty("hz_angle_deg")
    expect(r.records[0]).toHaveProperty("slope_dist_m")
  })

  test("GSI-8 负值处理", async () => {
    const gsi = "*110001+00000001 33.000-00012500"
    const p = await writeTmp("neg.gsi", gsi)
    const r = await run({ filePath: p, format: "gsi-8" })

    expect(r.records[0].height_diff_m).toBeLessThan(0)
  })
})

// ============================================================
// GSI-16 格式
// ============================================================
describe("format_parser - GSI-16", () => {
  test("解析标准 GSI-16 行", async () => {
    // GSI-16: 16字符数据域
    const gsi = "*110001+0000000000000001 21.002+0000000035012340 22.002+0000000089123450 31.000+0000000001253400"
    const p = await writeTmp("test16.gsi", gsi)
    const r = await run({ filePath: p, format: "gsi-16" })

    expect(r.format).toBe("gsi-16")
    expect(r.total_records).toBe(1)
    expect(r.records[0].point_id).toBe("1")
  })
})

// ============================================================
// DAT 格式
// ============================================================
describe("format_parser - DAT", () => {
  test("解析制表符分隔 DAT", async () => {
    const dat = [
      "point\thz_angle\tv_angle\tslope_dist",
      "P001\t45.5000\t89.1234\t125.340",
      "P002\t90.2500\t88.4567\t98.760",
    ].join("\n")
    const p = await writeTmp("test.dat", dat)
    const r = await run({ filePath: p, format: "dat-auto" })

    expect(r.format).toBe("dat")
    expect(r.total_records).toBe(2)
    expect(r.records[0].point_id).toBe("P001")
    expect(r.records[0].hz_angle_deg).toBeCloseTo(45.5, 1)
  })

  test("解析逗号分隔 DAT", async () => {
    const dat = ["编号,水平角,竖直角,斜距", "T001,120.5,85.3,50.25", "T002,240.1,84.8,60.10"].join("\n")
    const p = await writeTmp("cn.dat", dat)
    const r = await run({ filePath: p, format: "dat-auto" })

    expect(r.format).toBe("dat")
    expect(r.total_records).toBe(2)
    expect(r.records[0].point_id).toBe("T001")
  })

  test("解析含高程列", async () => {
    const dat = [
      "点号,东坐标,北坐标,高程",
      "BM1,500000.123,3000000.456,25.678",
      "BM2,500100.789,3000200.012,26.345",
    ].join("\n")
    const p = await writeTmp("coords.dat", dat)
    const r = await run({ filePath: p, format: "dat-auto" })

    expect(r.records[0].easting_m).toBeCloseTo(500000.123, 2)
    expect(r.records[0].northing_m).toBeCloseTo(3000000.456, 2)
    expect(r.records[0].elevation_m).toBeCloseTo(25.678, 2)
  })
})

// ============================================================
// 自动检测
// ============================================================
describe("format_parser - 自动检测", () => {
  test("自动识别 GSI 格式", async () => {
    const gsi = "*110001+00000001 21.002+03501234 31.000+00125340"
    const p = await writeTmp("auto.txt", gsi)
    const r = await run({ filePath: p, format: "dat-auto" })

    expect(r.format).toMatch(/gsi/)
  })

  test("自动识别 DAT 表格格式", async () => {
    const dat = ["point,easting,northing", "P1,100.5,200.3"].join("\n")
    const p = await writeTmp("auto_dat.txt", dat)
    const r = await run({ filePath: p, format: "dat-auto" })

    expect(r.format).toBe("dat")
  })
})

// ============================================================
// 错误处理
// ============================================================
describe("format_parser - 错误处理", () => {
  test("文件不存在", async () => {
    const r = await run({ filePath: "/nonexistent/data.gsi", format: "gsi-8" })
    expect(r.error).toContain("不存在")
  })

  test("空文件", async () => {
    const p = await writeTmp("empty.gsi", "")
    const r = await run({ filePath: p, format: "gsi-8" })
    expect(r.error).toContain("为空")
  })

  test("无法识别的格式", async () => {
    const p = await writeTmp("garbage.txt", "this is just random text\nno useful data here")
    const r = await run({ filePath: p, format: "dat-auto" })
    expect(r.error).toContain("无法识别")
  })
})
