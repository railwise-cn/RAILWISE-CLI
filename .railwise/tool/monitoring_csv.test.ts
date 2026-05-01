import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { unlink } from "node:fs/promises"
import path from "path"
import tool from "./monitoring_csv"

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
// 基本解析
// ============================================================
describe("monitoring_csv - 基本解析", () => {
  test("正常 CSV 解析", async () => {
    const csv = [
      "测点,日期,读数",
      "JC-01,2024-01-01,0.0",
      "JC-01,2024-01-02,0.5",
      "JC-01,2024-01-03,1.2",
      "JC-02,2024-01-01,0.0",
      "JC-02,2024-01-02,-0.3",
      "JC-02,2024-01-03,-0.8",
    ].join("\n")
    const p = await writeTmp("normal.csv", csv)
    const r = await run({ filePath: p, sensorType: "settlement", periodDays: 7 })

    expect(r.total_points).toBe(2)
    expect(r.summary).toHaveLength(2)
    expect(r.summary[0].point_id).toBe("JC-01")
    expect(r.summary[0].cumulative_mm).toBeCloseTo(1.2, 1)
  })

  test("Tab 分隔文件", async () => {
    const tsv = ["id\ttime\tvalue", "P1\t2024-01-01\t0", "P1\t2024-01-02\t1.5"].join("\n")
    const p = await writeTmp("tab.txt", tsv)
    const r = await run({ filePath: p, sensorType: "settlement" })

    expect(r.total_points).toBe(1)
    expect(r.summary[0].cumulative_mm).toBeCloseTo(1.5, 1)
  })

  test("分号分隔文件", async () => {
    const csv = ["point;date;val", "A;2024-01-01;0", "A;2024-01-02;2.0"].join("\n")
    const p = await writeTmp("semi.csv", csv)
    const r = await run({ filePath: p, sensorType: "convergence" })

    expect(r.total_points).toBe(1)
  })
})

// ============================================================
// 异常值剔除
// ============================================================
describe("monitoring_csv - 异常值剔除", () => {
  test("MAD 3σ 方法剔除跳变点", async () => {
    const rows = ["point,date,value"]
    for (let i = 0; i < 20; i++) {
      rows.push(`P1,2024-01-${String(i + 1).padStart(2, "0")},${i * 0.1}`)
    }
    // 插入一个巨大的跳变点
    rows.push("P1,2024-01-21,999.9")
    rows.push("P1,2024-01-22,2.1")

    const p = await writeTmp("outlier.csv", rows.join("\n"))
    const r = await run({ filePath: p, sensorType: "settlement" })

    const s = r.summary[0]
    expect(s.removed_outliers).toBeGreaterThan(0)
    expect(r.data_quality_note).toContain("剔除")
  })

  test("无异常时不剔除", async () => {
    const rows = ["point,date,value"]
    for (let i = 0; i < 10; i++) {
      rows.push(`P1,2024-01-${String(i + 1).padStart(2, "0")},${i * 0.5}`)
    }
    const p = await writeTmp("clean.csv", rows.join("\n"))
    const r = await run({ filePath: p, sensorType: "settlement" })

    expect(r.summary[0].removed_outliers).toBe(0)
    expect(r.data_quality_note).toContain("良好")
  })
})

// ============================================================
// 超限判定
// ============================================================
describe("monitoring_csv - 超限判定", () => {
  test("超出报警阈值标记", async () => {
    const csv = [
      "point,date,value",
      "JC-01,2024-01-01,0",
      "JC-01,2024-01-10,25",
      "JC-02,2024-01-01,0",
      "JC-02,2024-01-10,5",
    ].join("\n")
    const p = await writeTmp("exceeded.csv", csv)
    const r = await run({ filePath: p, sensorType: "settlement", alertThreshold: 20 })

    expect(r.exceeded_count).toBe(1)
    expect(r.exceeded_points).toContain("JC-01")
    expect(r.max_cumulative_point).toBe("JC-01")
  })

  test("不传阈值时不做超限判定", async () => {
    const csv = ["point,date,value", "P1,2024-01-01,0", "P1,2024-01-10,100"].join("\n")
    const p = await writeTmp("no_threshold.csv", csv)
    const r = await run({ filePath: p, sensorType: "settlement" })

    expect(r.alert_threshold_mm).toBeNull()
    expect(r.exceeded_count).toBe(0)
  })
})

// ============================================================
// 错误处理
// ============================================================
describe("monitoring_csv - 错误处理", () => {
  test("文件不存在", async () => {
    const r = await run({ filePath: "/nonexistent/file.csv", sensorType: "settlement" })
    expect(r.error).toContain("不存在")
  })

  test("不支持的格式", async () => {
    const p = await writeTmp("bad.xlsx", "fake")
    const r = await run({ filePath: p, sensorType: "settlement" })
    expect(r.error).toContain("暂不支持")
  })

  test("空文件", async () => {
    const p = await writeTmp("empty.csv", "header_only")
    const r = await run({ filePath: p, sensorType: "settlement" })
    expect(r.error).toBeDefined()
  })

  test("无法识别数值列", async () => {
    const csv = ["name,color,size", "A,red,big", "B,blue,small"].join("\n")
    const p = await writeTmp("no_value.csv", csv)
    const r = await run({ filePath: p, sensorType: "settlement" })
    expect(r.error).toContain("无法识别")
  })
})
