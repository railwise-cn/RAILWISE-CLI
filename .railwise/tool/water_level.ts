/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

export const water_level_analysis = tool({
  description:
    "基坑地下水位监测数据分析。根据水位观测井的水位数据序列，计算水位变化量、变化速率，判断降水效果和回灌影响。基坑自动化监测中水位监控的核心工具。data_analyst 处理水位数据时必须调用此工具。",
  args: {
    wellId: tool.schema.string().describe("观测井编号，如 SW-01"),
    wellType: tool.schema
      .enum(["pumping", "observation", "recharge"])
      .describe("井类型：pumping=降水井, observation=观测井, recharge=回灌井"),
    groundElevation: tool.schema.number().describe("井口地面标高(m)"),
    initialLevel: tool.schema.number().describe("初始水位标高(m)或初始埋深(m)"),
    levelType: tool.schema
      .enum(["elevation", "depth"])
      .default("elevation")
      .describe("水位值类型：elevation=绝对标高, depth=距地面埋深"),
    records: tool.schema
      .array(
        tool.schema.object({
          date: tool.schema.string().describe("观测日期 YYYY-MM-DD 或 YYYY-MM-DD HH:mm"),
          level: tool.schema.number().describe("水位值（标高m或埋深m，与levelType一致）"),
        }),
      )
      .min(1)
      .describe("水位观测数据"),
    targetLevel: tool.schema.number().optional().describe("目标降水水位标高(m)或目标埋深(m)"),
    alertRise: tool.schema.number().positive().optional().describe("水位回升报警值(m)，超过此值需预警"),
    excavationBottom: tool.schema.number().optional().describe("基坑底标高(m)，用于计算水头差"),
  },
  async execute(args) {
    const toElevation = (v: number) =>
      args.levelType === "elevation" ? v : args.groundElevation - v

    const initElev = toElevation(args.initialLevel)

    const analyzed = args.records.map((r, i) => {
      const elev = toElevation(r.level)
      const depth = args.groundElevation - elev
      const change = elev - initElev
      const headAboveExcavation = args.excavationBottom !== undefined ? elev - args.excavationBottom : null

      let status = "🟢 正常"
      if (args.alertRise && change > args.alertRise) {
        status = "🔴 水位回升超限"
      } else if (args.targetLevel !== undefined) {
        const targetElev = toElevation(args.targetLevel)
        if (elev > targetElev + 0.5) status = "🟡 未达目标"
        else if (elev <= targetElev) status = "🟢 已达目标"
      }

      return {
        date: r.date,
        elevation_m: Number(elev.toFixed(3)),
        depth_m: Number(depth.toFixed(3)),
        change_from_initial_m: Number(change.toFixed(3)),
        head_above_excavation_m: headAboveExcavation !== null ? Number(headAboveExcavation.toFixed(3)) : null,
        status,
      }
    })

    const rates: Array<{ period: string; rate_m_per_day: number }> = []
    for (let i = 1; i < analyzed.length; i++) {
      const dt =
        (new Date(args.records[i]!.date).getTime() - new Date(args.records[i - 1]!.date).getTime()) / 86400000
      if (dt > 0) {
        rates.push({
          period: `${args.records[i - 1]!.date} → ${args.records[i]!.date}`,
          rate_m_per_day: Number(
            ((analyzed[i]!.elevation_m - analyzed[i - 1]!.elevation_m) / dt).toFixed(4),
          ),
        })
      }
    }

    const latest = analyzed[analyzed.length - 1]!
    const lowest = analyzed.reduce((min, a) => (a.elevation_m < min.elevation_m ? a : min), analyzed[0]!)
    const highest = analyzed.reduce((max, a) => (a.elevation_m > max.elevation_m ? a : max), analyzed[0]!)
    const amplitude = highest.elevation_m - lowest.elevation_m

    let dewateringAssessment = ""
    if (args.targetLevel !== undefined) {
      const targetElev = toElevation(args.targetLevel)
      if (latest.elevation_m <= targetElev) {
        dewateringAssessment = "✅ 降水达标，水位已降至目标水位以下"
      } else {
        const gap = latest.elevation_m - targetElev
        dewateringAssessment = `⚠️ 降水未达标，当前水位高于目标 ${gap.toFixed(3)}m，需加强降水`
      }
    }

    let safetyAssessment = ""
    if (args.excavationBottom !== undefined && latest.head_above_excavation_m !== null) {
      if (latest.head_above_excavation_m > 0) {
        safetyAssessment = `⚠️ 水位高于基坑底 ${latest.head_above_excavation_m.toFixed(3)}m，存在突涌风险`
      } else {
        safetyAssessment = `✅ 水位低于基坑底 ${Math.abs(latest.head_above_excavation_m).toFixed(3)}m`
      }
    }

    return JSON.stringify({
      well_id: args.wellId,
      well_type: args.wellType === "pumping" ? "降水井" : args.wellType === "observation" ? "观测井" : "回灌井",
      ground_elevation_m: args.groundElevation,
      initial_elevation_m: Number(initElev.toFixed(3)),
      latest: {
        date: latest.date,
        elevation_m: latest.elevation_m,
        depth_m: latest.depth_m,
        change_m: latest.change_from_initial_m,
      },
      range: {
        lowest_m: lowest.elevation_m,
        highest_m: highest.elevation_m,
        amplitude_m: Number(amplitude.toFixed(3)),
      },
      records: analyzed,
      rates,
      dewatering_assessment: dewateringAssessment || undefined,
      safety_assessment: safetyAssessment || undefined,
      message: `✅ ${args.wellId} 水位分析：当前标高 ${latest.elevation_m}m（埋深 ${latest.depth_m}m），较初始${latest.change_from_initial_m > 0 ? "上升" : "下降"} ${Math.abs(latest.change_from_initial_m).toFixed(3)}m`,
    })
  },
})

export const water_level_contour = tool({
  description:
    "多井水位等值线数据生成。根据多个观测井的坐标和水位数据，计算水位梯度和流向，为绘制等水位线图提供数据。用于基坑降水效果评估。",
  args: {
    wells: tool.schema
      .array(
        tool.schema.object({
          id: tool.schema.string().describe("井编号"),
          x: tool.schema.number().describe("X坐标(m)"),
          y: tool.schema.number().describe("Y坐标(m)"),
          elevation: tool.schema.number().describe("当前水位标高(m)"),
        }),
      )
      .min(3)
      .describe("各井位置和水位（至少3口井）"),
    excavationCenter: tool.schema
      .object({
        x: tool.schema.number().describe("基坑中心X"),
        y: tool.schema.number().describe("基坑中心Y"),
      })
      .optional()
      .describe("基坑中心坐标，用于判断降水漏斗形态"),
  },
  async execute(args) {
    const n = args.wells.length
    const avgElev = args.wells.reduce((s, w) => s + w.elevation, 0) / n
    const maxWell = args.wells.reduce((max, w) => (w.elevation > max.elevation ? w : max), args.wells[0]!)
    const minWell = args.wells.reduce((min, w) => (w.elevation < min.elevation ? w : min), args.wells[0]!)

    const gradients: Array<{
      from: string
      to: string
      gradient: number
      distance_m: number
      direction_deg: number
    }> = []

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const a = args.wells[i]!
        const b = args.wells[j]!
        const dist = Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)
        if (dist < 0.1) continue
        const grad = Math.abs(b.elevation - a.elevation) / dist
        const dir = (Math.atan2(b.x - a.x, b.y - a.y) * 180) / Math.PI
        gradients.push({
          from: a.id,
          to: b.id,
          gradient: Number(grad.toFixed(6)),
          distance_m: Number(dist.toFixed(2)),
          direction_deg: Number(((dir + 360) % 360).toFixed(1)),
        })
      }
    }

    const avgGradient = gradients.length > 0
      ? gradients.reduce((s, g) => s + g.gradient, 0) / gradients.length
      : 0

    let funnelAssessment = ""
    if (args.excavationCenter) {
      const cx = args.excavationCenter.x
      const cy = args.excavationCenter.y
      const sorted = args.wells
        .map((w) => ({ id: w.id, elev: w.elevation, dist: Math.sqrt((w.x - cx) ** 2 + (w.y - cy) ** 2) }))
        .sort((a, b) => a.dist - b.dist)

      const innerAvg = sorted.slice(0, Math.ceil(n / 2)).reduce((s, w) => s + w.elev, 0) / Math.ceil(n / 2)
      const outerAvg = sorted.slice(Math.ceil(n / 2)).reduce((s, w) => s + w.elev, 0) / (n - Math.ceil(n / 2))

      if (innerAvg < outerAvg) {
        funnelAssessment = `✅ 降水漏斗形态正常：内侧平均水位 ${innerAvg.toFixed(3)}m < 外侧 ${outerAvg.toFixed(3)}m`
      } else {
        funnelAssessment = `⚠️ 降水漏斗异常：内侧平均水位 ${innerAvg.toFixed(3)}m ≥ 外侧 ${outerAvg.toFixed(3)}m，降水效果不佳`
      }
    }

    return JSON.stringify({
      well_count: n,
      average_elevation_m: Number(avgElev.toFixed(3)),
      max_well: { id: maxWell.id, elevation_m: maxWell.elevation },
      min_well: { id: minWell.id, elevation_m: minWell.elevation },
      level_difference_m: Number((maxWell.elevation - minWell.elevation).toFixed(3)),
      average_gradient: Number(avgGradient.toFixed(6)),
      gradients,
      funnel_assessment: funnelAssessment || undefined,
      message: `✅ ${n}口井水位分析：水位差 ${(maxWell.elevation - minWell.elevation).toFixed(3)}m，平均梯度 ${avgGradient.toFixed(6)}`,
    })
  },
})
