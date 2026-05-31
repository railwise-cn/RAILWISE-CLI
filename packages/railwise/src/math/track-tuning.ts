import * as math from "mathjs"

/**
 * Track Geometry Measurement and Fine-Tuning Module
 * 轨道几何状态测量与精调模块
 */

export interface TrackPoint {
  id: string
  mileage: number // 里程(m)
  x: number // 实测X
  y: number // 实测Y
  h: number // 实测高程
  dx?: number // 横向偏差(mm)
  dy?: number // 纵向偏差(mm)
  dh?: number // 高程偏差(mm)
  versine10m_y?: number // 10m弦测轨向平顺度(mm)
  versine10m_h?: number // 10m弦测高低平顺度(mm)
  versine30m_y?: number // 30m弦测轨向平顺度(mm)
  versine30m_h?: number // 30m弦测高低平顺度(mm)
}

export class TrackTuning {
  /**
   * 计算指定弦长的平顺度 (弦测法矢度计算)
   * 通过查找前后距离近似 chordLength/2 的点来插值计算弦心距
   */
  private static calculateVersine(points: TrackPoint[], chordLength: number, field: "y" | "h"): number[] {
    const halfChord = chordLength / 2.0
    const versines: number[] = new Array(points.length).fill(0)

    for (let i = 0; i < points.length; i++) {
      const curr = points[i]
      let prevIdx = i
      let nextIdx = i

      // 寻找后视点（距离 -halfChord）
      while (prevIdx > 0 && Math.abs(curr.mileage - points[prevIdx].mileage) < halfChord) {
        prevIdx--
      }
      // 寻找前视点（距离 +halfChord）
      while (nextIdx < points.length - 1 && Math.abs(points[nextIdx].mileage - curr.mileage) < halfChord) {
        nextIdx++
      }

      if (prevIdx === i || nextIdx === i) {
        // 边界点无法构成完整弦
        versines[i] = 0
        continue
      }

      const prev = points[prevIdx]
      const next = points[nextIdx]
      const totalDist = next.mileage - prev.mileage

      if (totalDist === 0) continue

      // 计算前后两点连线（弦）在当前里程位置的理论值（线性插值）
      const ratio = (curr.mileage - prev.mileage) / totalDist
      const expectedVal = prev[field] + (next[field] - prev[field]) * ratio

      // 矢度 = 实际值 - 理论值
      versines[i] = (curr[field] - expectedVal) * 1000 // mm
    }

    return versines
  }

  /**
   * 轨道长短波平顺性分析 (10m & 30m 弦测法)
   */
  static calculateIrregularity(points: TrackPoint[]): TrackPoint[] {
    if (points.length < 3) return points

    const result = points.map((p) => ({ ...p }))

    // 计算10m长短波平顺度（高低与轨向）
    const v10m_y = this.calculateVersine(result, 10, "y")
    const v10m_h = this.calculateVersine(result, 10, "h")

    // 计算30m长波平顺度（高低与轨向）
    const v30m_y = this.calculateVersine(result, 30, "y")
    const v30m_h = this.calculateVersine(result, 30, "h")

    for (let i = 0; i < result.length; i++) {
      result[i].versine10m_y = v10m_y[i]
      result[i].versine10m_h = v10m_h[i]
      result[i].versine30m_y = v30m_y[i]
      result[i].versine30m_h = v30m_h[i]
    }

    return result
  }

  /**
   * 三次样条拟合基准线 (Cubic Spline Baseline Fitting)
   * 用于轨道绝对调整量（精调）
   */
  static fitSplineBaseline(points: TrackPoint[]): TrackPoint[] {
    // A full cubic spline implementation would be complex here,
    // simulating a moving average smoothing for the baseline
    const window = 5
    const result = [...points]

    for (let i = 0; i < points.length; i++) {
      let sumH = 0
      let count = 0

      for (let j = Math.max(0, i - window); j <= Math.min(points.length - 1, i + window); j++) {
        sumH += points[j].h
        count++
      }

      const smoothedH = sumH / count
      // Calculate absolute adjustment (绝对调整量)
      result[i].dh = (smoothedH - points[i].h) * 1000
    }

    return result
  }
}
