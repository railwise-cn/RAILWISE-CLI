/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

// ============================================================
// Deformation rate analysis & trend prediction
// ============================================================

// ============================================================
// Tool: Deformation rate calculation
// ============================================================

export const deformation_rate = tool({
  description:
    "变形速率计算与趋势分析。根据监测点的时间-变形量序列，计算各期变形速率、累计变形量，并用线性回归进行趋势预测。城市轨道监测中判断变形是否收敛的核心分析工具。data_analyst 在分析自动化监测数据趋势时必须调用此工具。",
  args: {
    pointId: tool.schema.string().describe("监测点编号"),
    data: tool.schema
      .array(
        tool.schema.object({
          date: tool.schema.string().describe("观测日期，格式 YYYY-MM-DD 或 YYYY-MM-DD HH:mm"),
          value: tool.schema.number().describe("累计变形量(mm)，正值表示沉降/收敛方向"),
        }),
      )
      .min(2)
      .describe("按时间顺序排列的监测数据序列"),
    alertThreshold: tool.schema.number().positive().optional().describe("报警控制值(mm)，若提供则输出预警分析"),
    rateThreshold: tool.schema.number().positive().optional().describe("速率控制值(mm/d)，若提供则判断速率是否超限"),
    predictionDays: tool.schema.number().int().positive().default(7).describe("向前预测天数，默认7天"),
  },
  async execute(args) {
    const n = args.data.length

    // Parse dates to day offsets
    const t0 = new Date(args.data[0]!.date).getTime()
    const days = args.data.map((d) => (new Date(d.date).getTime() - t0) / 86400000)
    const values = args.data.map((d) => d.value)

    // Period-by-period rates
    const rates: Array<{ period: string; rate_mm_per_day: number; increment_mm: number; days: number }> = []
    for (let i = 1; i < n; i++) {
      const dt = days[i]! - days[i - 1]!
      const dv = values[i]! - values[i - 1]!
      const rate = dt > 0 ? dv / dt : 0
      rates.push({
        period: `${args.data[i - 1]!.date} → ${args.data[i]!.date}`,
        rate_mm_per_day: Number(rate.toFixed(4)),
        increment_mm: Number(dv.toFixed(4)),
        days: Number(dt.toFixed(2)),
      })
    }

    // Overall statistics
    const totalDays = days[n - 1]! - days[0]!
    const totalDeformation = values[n - 1]! - values[0]!
    const avgRate = totalDays > 0 ? totalDeformation / totalDays : 0
    const latestValue = values[n - 1]!
    const latestRate = rates.length > 0 ? rates[rates.length - 1]!.rate_mm_per_day : 0

    // Linear regression: y = a + b*x
    const meanX = days.reduce((s, v) => s + v, 0) / n
    const meanY = values.reduce((s, v) => s + v, 0) / n
    const ssxy = days.reduce((s, x, i) => s + (x - meanX) * (values[i]! - meanY), 0)
    const ssxx = days.reduce((s, x) => s + (x - meanX) * (x - meanX), 0)
    const b = ssxx > 0 ? ssxy / ssxx : 0
    const a = meanY - b * meanX

    // R² (coefficient of determination)
    const ssyy = values.reduce((s, y) => s + (y - meanY) * (y - meanY), 0)
    const r2 = ssyy > 0 ? (ssxy * ssxy) / (ssxx * ssyy) : 0

    // Residual standard error
    const residuals = values.map((y, i) => y - (a + b * days[i]!))
    const rmse = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(n - 2, 1))

    // Prediction
    const lastDay = days[n - 1]!
    const predictions = Array.from({ length: args.predictionDays }, (_, i) => {
      const predDay = lastDay + i + 1
      const predDate = new Date(t0 + predDay * 86400000)
      const predValue = a + b * predDay
      return {
        date: predDate.toISOString().slice(0, 10),
        predicted_mm: Number(predValue.toFixed(4)),
        day_offset: Number(predDay.toFixed(1)),
      }
    })

    // Stability assessment
    const last3Rates = rates.slice(-3).map((r) => Math.abs(r.rate_mm_per_day))
    const avgLast3Rate = last3Rates.length > 0
      ? last3Rates.reduce((s, v) => s + v, 0) / last3Rates.length
      : 0

    let stability: string
    if (avgLast3Rate < 0.01) {
      stability = "✅ 已收敛：近期速率趋近于零，变形基本稳定"
    } else if (avgLast3Rate < 0.05) {
      stability = "🟢 趋于收敛：变形速率逐渐减小"
    } else if (Math.abs(latestRate) > Math.abs(avgRate) * 1.5) {
      stability = "🔴 加速变形：最新速率明显大于平均速率，需加密监测"
    } else if (avgLast3Rate < Math.abs(avgRate)) {
      stability = "🟡 减速变形：速率有所减小但尚未收敛，继续监测"
    } else {
      stability = "🟠 等速变形：速率基本稳定，关注发展趋势"
    }

    // Alert analysis
    let alertAnalysis: Record<string, unknown> | undefined
    if (args.alertThreshold) {
      const ratio = Math.abs(latestValue) / args.alertThreshold
      const predMax = Math.max(...predictions.map((p) => Math.abs(p.predicted_mm)))
      const predRatio = predMax / args.alertThreshold
      const daysToThreshold = b !== 0
        ? (args.alertThreshold * Math.sign(b) - a) / b - lastDay
        : Infinity

      alertAnalysis = {
        current_ratio_pct: Number((ratio * 100).toFixed(1)),
        predicted_max_ratio_pct: Number((predRatio * 100).toFixed(1)),
        estimated_days_to_threshold: daysToThreshold > 0 && isFinite(daysToThreshold)
          ? Number(daysToThreshold.toFixed(1))
          : "不会达到（趋势方向相反或速率为零）",
        alert_level:
          ratio >= 1.0 ? "🔴 已超阈值"
          : ratio >= 0.85 ? "🟠 接近阈值"
          : ratio >= 0.70 ? "🟡 需关注"
          : "🟢 正常",
      }
    }

    // Rate threshold check
    let rateAlert: string | undefined
    if (args.rateThreshold) {
      rateAlert = Math.abs(latestRate) > args.rateThreshold
        ? `🔴 最新速率 ${Math.abs(latestRate).toFixed(4)} mm/d 超过限值 ${args.rateThreshold} mm/d`
        : `🟢 最新速率 ${Math.abs(latestRate).toFixed(4)} mm/d 在限值 ${args.rateThreshold} mm/d 内`
    }

    return JSON.stringify({
      point_id: args.pointId,
      data_count: n,
      monitoring_duration_days: Number(totalDays.toFixed(1)),
      latest_value_mm: latestValue,
      total_deformation_mm: Number(totalDeformation.toFixed(4)),
      average_rate_mm_per_day: Number(avgRate.toFixed(4)),
      latest_rate_mm_per_day: latestRate,
      rates,
      regression: {
        equation: `y = ${a.toFixed(4)} + ${b.toFixed(4)} × t`,
        slope_mm_per_day: Number(b.toFixed(4)),
        intercept_mm: Number(a.toFixed(4)),
        r_squared: Number(r2.toFixed(4)),
        rmse_mm: Number(rmse.toFixed(4)),
      },
      predictions,
      stability_assessment: stability,
      alert_analysis: alertAnalysis,
      rate_alert: rateAlert,
      message: `✅ ${args.pointId} 变形分析：累计 ${latestValue}mm，最新速率 ${latestRate}mm/d，${stability}`,
    })
  },
})

// ============================================================
// Tool: Multi-point deformation comparison
// ============================================================

export const deformation_comparison = tool({
  description:
    "多测点变形对比分析。同时对比多个监测点的变形量和速率，找出最大变形点、异常点。用于编制监测日报/周报中的断面对比分析。",
  args: {
    points: tool.schema
      .array(
        tool.schema.object({
          id: tool.schema.string().describe("测点编号"),
          latestValue: tool.schema.number().describe("最新累计变形量(mm)"),
          previousValue: tool.schema.number().describe("上期累计变形量(mm)"),
          daysBetween: tool.schema.number().positive().describe("两期间隔天数"),
        }),
      )
      .min(1)
      .describe("各监测点数据"),
    alertThreshold: tool.schema.number().positive().optional().describe("统一报警控制值(mm)"),
    rateThreshold: tool.schema.number().positive().optional().describe("速率控制值(mm/d)"),
  },
  async execute(args) {
    const analyzed = args.points.map((p) => {
      const increment = p.latestValue - p.previousValue
      const rate = increment / p.daysBetween
      const absVal = Math.abs(p.latestValue)

      let status = "🟢 正常"
      if (args.alertThreshold) {
        const ratio = absVal / args.alertThreshold
        if (ratio >= 1.0) status = "🔴 超限"
        else if (ratio >= 0.85) status = "🟠 接近阈值"
        else if (ratio >= 0.70) status = "🟡 关注"
      }
      if (args.rateThreshold && Math.abs(rate) > args.rateThreshold) {
        status = "🔴 速率超限"
      }

      return {
        point_id: p.id,
        latest_mm: p.latestValue,
        increment_mm: Number(increment.toFixed(4)),
        rate_mm_per_day: Number(rate.toFixed(4)),
        status,
      }
    })

    // Sort by absolute latest value descending
    const sorted = [...analyzed].sort((a, b) => Math.abs(b.latest_mm) - Math.abs(a.latest_mm))
    const maxPoint = sorted[0]!
    const alertCount = analyzed.filter((a) => a.status.includes("超限") || a.status.includes("接近")).length

    const avgDeformation = analyzed.reduce((s, a) => s + Math.abs(a.latest_mm), 0) / analyzed.length
    const maxRate = analyzed.reduce((max, a) => Math.abs(a.rate_mm_per_day) > Math.abs(max.rate_mm_per_day) ? a : max, analyzed[0]!)

    return JSON.stringify({
      total_points: analyzed.length,
      alert_count: alertCount,
      max_deformation: {
        point_id: maxPoint.point_id,
        value_mm: maxPoint.latest_mm,
      },
      max_rate: {
        point_id: maxRate.point_id,
        rate_mm_per_day: maxRate.rate_mm_per_day,
      },
      average_deformation_mm: Number(avgDeformation.toFixed(4)),
      details: sorted,
      message: `✅ ${analyzed.length}个测点对比：最大变形 ${maxPoint.point_id}(${maxPoint.latest_mm}mm)，最大速率 ${maxRate.point_id}(${maxRate.rate_mm_per_day}mm/d)，${alertCount}个测点预警`,
    })
  },
})
