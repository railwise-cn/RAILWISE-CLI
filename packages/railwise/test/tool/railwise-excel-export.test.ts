import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import { monitoring_table_export } from "../../../../.railwise/tool/excel_export"

describe("railwise excel export tool", () => {
  test("accepts monitoring table fields documented by the Excel skill", async () => {
    await using tmp = await tmpdir()
    const out = path.join(tmp.path, "monitoring.xlsx")
    const result = JSON.parse(
      await monitoring_table_export.execute({
        projectName: "宁波轨道保护区监测模拟项目",
        monitoringType: "settlement",
        date: "2026-05-05",
        warningValue: 21,
        alarmValue: 30,
        unit: "mm",
        outputPath: out,
        points: [
          {
            pointId: "DB-03",
            location: "基坑东南角",
            initialValue: 0,
            previousValue: 18.1,
            currentValue: 26,
            periodChange: 7.9,
            cumulativeChange: 26,
            rate: 1.58,
          },
        ],
      } as never, {} as never),
    )

    expect(result.max_point).toEqual({ id: "DB-03", value: 26 })
    expect(result.alert_count).toBe(1)
    expect(result.message).toContain("DB-03(26mm)")
    expect(await Bun.file(out).exists()).toBe(true)
  })
})
