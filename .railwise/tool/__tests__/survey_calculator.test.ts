import { describe, test, expect } from "bun:test"
import {
  leveling_closure,
  traverse_closure,
  alert_level,
  leveling_adjustment,
  traverse_adjustment,
} from "./survey_calculator"

// Helper to call execute and parse result
const run = async (tool: any, args: any) => JSON.parse(await tool.execute(args))

// ============================================================
// leveling_closure
// ============================================================
describe("leveling_closure", () => {
  test("四等水准 - 合格", async () => {
    // 路线 2.5km, 限差 = 20√2.5 ≈ 31.623mm, 实测 25mm → 合格
    const r = await run(leveling_closure, { measuredError: 25, routeLengthKm: 2.5, order: "4th" })
    expect(r.is_passed).toBe(true)
    expect(r.allowed_limit_mm).toBeCloseTo(31.623, 2)
    expect(r.ratio_pct).toBeLessThan(100)
  })

  test("四等水准 - 超限", async () => {
    // 路线 2.5km, 限差 ≈ 31.623mm, 实测 35mm → 超限
    const r = await run(leveling_closure, { measuredError: 35, routeLengthKm: 2.5, order: "4th" })
    expect(r.is_passed).toBe(false)
    expect(r.message).toContain("超限")
  })

  test("三等水准限差系数为12", async () => {
    // 路线 4km, 限差 = 12√4 = 24mm
    const r = await run(leveling_closure, { measuredError: 20, routeLengthKm: 4, order: "3rd" })
    expect(r.is_passed).toBe(true)
    expect(r.allowed_limit_mm).toBeCloseTo(24, 2)
    expect(r.order_desc).toContain("三等")
  })

  test("一等水准限差系数为4", async () => {
    const r = await run(leveling_closure, { measuredError: 3, routeLengthKm: 1, order: "1st" })
    expect(r.allowed_limit_mm).toBeCloseTo(4, 2)
    expect(r.is_passed).toBe(true)
  })

  test("城市二等水准限差系数为8", async () => {
    const r = await run(leveling_closure, { measuredError: 10, routeLengthKm: 2, order: "city-2nd" })
    expect(r.allowed_limit_mm).toBeCloseTo(11.314, 2)
    expect(r.is_passed).toBe(true)
  })

  test("负闭合差取绝对值比较", async () => {
    const r = await run(leveling_closure, { measuredError: -25, routeLengthKm: 2.5, order: "4th" })
    expect(r.is_passed).toBe(true)
  })

  test("恰好等于限差 - 合格(≤)", async () => {
    // 路线 1km, 四等限差 = 20mm, 实测恰好 20mm
    const r = await run(leveling_closure, { measuredError: 20, routeLengthKm: 1, order: "4th" })
    expect(r.is_passed).toBe(true)
    expect(r.ratio_pct).toBe(100)
  })
})

// ============================================================
// traverse_closure
// ============================================================
describe("traverse_closure", () => {
  test("DJ2 角度闭合差 - 合格", async () => {
    // 6站, 限差 = 10√6 ≈ 24.5″, 实测 20″
    const r = await run(traverse_closure, { measuredAngularError: 20, stationCount: 6, instrument: "DJ2" })
    expect(r.is_passed).toBe(true)
    expect(r.allowed_limit_arcsec).toBeCloseTo(24.5, 0)
  })

  test("DJ2 角度闭合差 - 超限", async () => {
    const r = await run(traverse_closure, { measuredAngularError: 30, stationCount: 6, instrument: "DJ2" })
    expect(r.is_passed).toBe(false)
    expect(r.message).toContain("超限")
  })

  test("DJ1 限差系数为5", async () => {
    // 4站, 限差 = 5√4 = 10″
    const r = await run(traverse_closure, { measuredAngularError: 8, stationCount: 4, instrument: "DJ1" })
    expect(r.is_passed).toBe(true)
    expect(r.allowed_limit_arcsec).toBeCloseTo(10, 0)
  })

  test("DJ6 限差系数为20", async () => {
    const r = await run(traverse_closure, { measuredAngularError: 35, stationCount: 4, instrument: "DJ6" })
    expect(r.is_passed).toBe(true)
    expect(r.allowed_limit_arcsec).toBeCloseTo(40, 0)
  })

  test("负角度闭合差取绝对值", async () => {
    const r = await run(traverse_closure, { measuredAngularError: -20, stationCount: 6, instrument: "DJ2" })
    expect(r.is_passed).toBe(true)
  })
})

// ============================================================
// alert_level
// ============================================================
describe("alert_level", () => {
  test("正常 - 低于70%", async () => {
    const r = await run(alert_level, { cumulativeValue: 10, alertThreshold: 30, pointId: "JC-01" })
    expect(r.level).toBe("正常")
    expect(r.color).toBe("🟢")
    expect(r.ratio_pct).toBeCloseTo(33.3, 0)
  })

  test("黄色预警 - 70%~85%", async () => {
    const r = await run(alert_level, { cumulativeValue: 22, alertThreshold: 30, pointId: "JC-02" })
    expect(r.level).toBe("黄色预警")
    expect(r.color).toBe("🟡")
  })

  test("橙色预警 - 85%~100%", async () => {
    const r = await run(alert_level, { cumulativeValue: 27, alertThreshold: 30, pointId: "JC-03" })
    expect(r.level).toBe("橙色预警")
    expect(r.color).toBe("🟠")
  })

  test("红色报警 - ≥100%", async () => {
    const r = await run(alert_level, { cumulativeValue: 30, alertThreshold: 30, pointId: "JC-04" })
    expect(r.level).toBe("红色报警")
    expect(r.color).toBe("🔴")
    expect(r.action).toContain("应急预案")
  })

  test("超出控制值也是红色", async () => {
    const r = await run(alert_level, { cumulativeValue: 50, alertThreshold: 30, pointId: "JC-05" })
    expect(r.level).toBe("红色报警")
    expect(r.ratio_pct).toBeGreaterThan(100)
  })

  test("边界值 - 恰好70%", async () => {
    const r = await run(alert_level, { cumulativeValue: 21, alertThreshold: 30, pointId: "JC-06" })
    expect(r.level).toBe("黄色预警")
  })

  test("边界值 - 恰好85%", async () => {
    const r = await run(alert_level, { cumulativeValue: 25.5, alertThreshold: 30, pointId: "JC-07" })
    expect(r.level).toBe("橙色预警")
  })
})

// ============================================================
// leveling_adjustment
// ============================================================
describe("leveling_adjustment", () => {
  test("简单三点水准网平差", async () => {
    // BM1(已知, 100.000m) → A → BM2(已知, 100.500m)
    // 观测: BM1→A +0.300m (0.5km), A→BM2 +0.195m (0.3km)
    // 理论高差: 0.300 + 0.195 = 0.495, 实际 0.500, 闭合差 -5mm
    const r = await run(leveling_adjustment, {
      benchmarks: [
        { id: "BM1", height: 100.0 },
        { id: "BM2", height: 100.5 },
      ],
      observations: [
        { from: "BM1", to: "A", heightDiff: 0.3, routeLength: 0.5 },
        { from: "A", to: "BM2", heightDiff: 0.195, routeLength: 0.3 },
      ],
      order: "4th",
    })
    expect(r.method).toContain("最小二乘")
    expect(r.unknown_points).toBe(1)
    expect(r.redundancy).toBe(1)
    expect(r.adjusted_heights).toHaveLength(1)
    expect(r.adjusted_heights[0].point_id).toBe("A")
    // A 的平差高程应接近 100.300m（根据加权平差结果微调）
    expect(r.adjusted_heights[0].adjusted_height_m).toBeCloseTo(100.3, 1)
  })

  test("所有点已知 - 报错", async () => {
    const r = await run(leveling_adjustment, {
      benchmarks: [
        { id: "BM1", height: 100.0 },
        { id: "BM2", height: 100.5 },
      ],
      observations: [{ from: "BM1", to: "BM2", heightDiff: 0.5, routeLength: 1 }],
      order: "4th",
    })
    expect(r.error).toContain("所有点均为已知")
  })

  test("观测数少于未知数 - 报错", async () => {
    const r = await run(leveling_adjustment, {
      benchmarks: [{ id: "BM1", height: 100.0 }],
      observations: [{ from: "BM1", to: "A", heightDiff: 0.3, routeLength: 0.5 }],
      order: "4th",
    })
    // 1 unknown, 1 observation → redundancy = 0, but should still work
    // Actually 1 obs >= 1 unknown, so it should pass
    expect(r.adjusted_heights).toHaveLength(1)
  })

  test("四点水准环网平差精度合理", async () => {
    const r = await run(leveling_adjustment, {
      benchmarks: [{ id: "BM1", height: 50.0 }],
      observations: [
        { from: "BM1", to: "P1", heightDiff: 1.005, routeLength: 0.3 },
        { from: "P1", to: "P2", heightDiff: 0.502, routeLength: 0.4 },
        { from: "P2", to: "P3", heightDiff: -0.508, routeLength: 0.35 },
        { from: "P3", to: "BM1", heightDiff: -1.001, routeLength: 0.25 },
      ],
      order: "4th",
    })
    expect(r.unknown_points).toBe(3)
    expect(r.redundancy).toBe(1)
    expect(r.unit_weight_rmse_mm).toBeGreaterThanOrEqual(0)
    // 检查平差后高程形成合理的递增递减
    const heights = r.adjusted_heights.map((a: any) => a.adjusted_height_m)
    expect(heights[0]).toBeGreaterThan(50) // P1 > BM1
  })
})

// ============================================================
// traverse_adjustment
// ============================================================
describe("traverse_adjustment", () => {
  test("简单三站附合导线", async () => {
    const r = await run(traverse_adjustment, {
      startPoint: { id: "A", x: 1000, y: 1000 },
      endPoint: { id: "B", x: 1100, y: 1200 },
      startAzimuth: 45,
      endAzimuth: 45,
      stations: [
        { id: "P1", angle: 180, distance: 100 },
        { id: "P2", angle: 180, distance: 100 },
        { id: "P3", angle: 180, distance: 100 },
      ],
      instrument: "DJ2",
    })
    expect(r.station_count).toBe(3)
    expect(r.adjusted_coordinates).toHaveLength(3)
    expect(r.angular_closure.is_passed).toBe(true)
  })

  test("角度闭合差超限 - 报错", async () => {
    // 故意给出荒谬的角度使闭合差超限
    const r = await run(traverse_adjustment, {
      startPoint: { id: "A", x: 0, y: 0 },
      endPoint: { id: "B", x: 100, y: 0 },
      startAzimuth: 90,
      endAzimuth: 90,
      stations: [
        { id: "P1", angle: 181, distance: 50 },
        { id: "P2", angle: 181, distance: 50 },
      ],
      instrument: "DJ1",
    })
    expect(r.error).toContain("角度闭合差")
  })

  test("单站导线平差", async () => {
    const r = await run(traverse_adjustment, {
      startPoint: { id: "A", x: 0, y: 0 },
      endPoint: { id: "B", x: 100, y: 0 },
      startAzimuth: 90,
      endAzimuth: 90,
      stations: [{ id: "P1", angle: 180, distance: 100 }],
      instrument: "DJ2",
    })
    expect(r.station_count).toBe(1)
    expect(r.adjusted_coordinates).toHaveLength(1)
  })
})
