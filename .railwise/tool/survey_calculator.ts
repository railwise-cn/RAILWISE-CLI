/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

const LEVELING_LIMITS: Record<string, { k: number; unit: string; desc: string }> = {
  "1st": { k: 4, unit: "mm", desc: "一等水准" },
  "2nd": { k: 6, unit: "mm", desc: "二等水准（城市轨道交通监测基准网常用）" },
  "3rd": { k: 12, unit: "mm", desc: "三等水准" },
  "4th": { k: 20, unit: "mm", desc: "四等水准" },
  "city-2nd": { k: 8, unit: "mm", desc: "城市二等水准" },
}

const TRAVERSE_ANGULAR_LIMITS: Record<string, { k: number; desc: string }> = {
  DJ1: { k: 5, desc: "DJ1 经纬仪" },
  DJ2: { k: 10, desc: "DJ2 经纬仪（城市测量常用）" },
  DJ6: { k: 20, desc: "DJ6 经纬仪" },
}

export const leveling_closure = tool({
    description:
      "计算水准测量的高程闭合差是否在规范限差内。当需要判断外业水准数据是否合格时，必须调用此工具，绝不能自己口算或估算。",
    args: {
      measuredError: tool.schema
        .number()
        .describe("现场实际测算出的高程闭合差，单位为毫米(mm)，允许负值"),
      routeLengthKm: tool.schema
        .number()
        .positive()
        .describe("水准路线的总长度，单位为公里(km)"),
      order: tool.schema
        .enum(["1st", "2nd", "3rd", "4th", "city-2nd"])
        .default("4th")
        .describe(
          "测量等级：1st=一等, 2nd=二等, 3rd=三等, 4th=四等, city-2nd=城市二等"
        ),
    },
    async execute(args) {
      const spec = LEVELING_LIMITS[args.order]!
      const limit = spec.k * Math.sqrt(args.routeLengthKm)
      const pass = Math.abs(args.measuredError) <= limit

      return JSON.stringify({
        measured_error_mm: args.measuredError,
        allowed_limit_mm: Number(limit.toFixed(3)),
        order_desc: spec.desc,
        formula: `±${spec.k}√L = ±${spec.k}×√${args.routeLengthKm} = ±${limit.toFixed(3)} mm`,
        is_passed: pass,
        ratio_pct: Number(((Math.abs(args.measuredError) / limit) * 100).toFixed(1)),
        message: pass
          ? `✅ 合格：实测闭合差 ${args.measuredError}mm，限差 ±${limit.toFixed(3)}mm，占限差比例 ${((Math.abs(args.measuredError) / limit) * 100).toFixed(1)}%`
          : `❌ 超限：实测闭合差 ${args.measuredError}mm，限差 ±${limit.toFixed(3)}mm，超出限差 ${(Math.abs(args.measuredError) - limit).toFixed(3)}mm，必须返工重测！`,
      })
    },
  })

export const traverse_closure = tool({
    description:
      "计算附合导线或闭合导线的角度闭合差是否满足规范限差。调用前请确认仪器等级和测站数量。",
    args: {
      measuredAngularError: tool.schema
        .number()
        .describe("实测角度闭合差，单位为角秒(″)，允许负值"),
      stationCount: tool.schema
        .int()
        .positive()
        .describe("导线测站总数（转折点数量，不含起始点）"),
      instrument: tool.schema
        .enum(["DJ1", "DJ2", "DJ6"])
        .default("DJ2")
        .describe("使用的经纬仪等级：DJ1/DJ2/DJ6"),
    },
    async execute(args) {
      const spec = TRAVERSE_ANGULAR_LIMITS[args.instrument]!
      const limit = spec.k * Math.sqrt(args.stationCount)
      const pass = Math.abs(args.measuredAngularError) <= limit

      return JSON.stringify({
        measured_error_arcsec: args.measuredAngularError,
        allowed_limit_arcsec: Number(limit.toFixed(1)),
        instrument_desc: spec.desc,
        formula: `±${spec.k}″√n = ±${spec.k}×√${args.stationCount} = ±${limit.toFixed(1)}″`,
        is_passed: pass,
        message: pass
          ? `✅ 合格：角度闭合差 ${args.measuredAngularError}″，限差 ±${limit.toFixed(1)}″`
          : `❌ 超限：角度闭合差 ${args.measuredAngularError}″，限差 ±${limit.toFixed(1)}″，超出 ${(Math.abs(args.measuredAngularError) - limit).toFixed(1)}″，必须返工重测！`,
      })
    },
  })

export const alert_level = tool({
    description:
      "根据监测点当前累计变化量和控制指标，计算预警等级。自动判断属于蓝色提示/黄色预警/红色报警/正常。",
    args: {
      cumulativeValue: tool.schema
        .number()
        .describe("当前累计变化量绝对值，单位 mm（取绝对值传入）"),
      alertThreshold: tool.schema
        .number()
        .positive()
        .describe("规范规定的报警控制值（红线），单位 mm"),
      pointId: tool.schema.string().describe("测点编号，如 JC-01"),
    },
    async execute(args) {
      const ratio = args.cumulativeValue / args.alertThreshold
      let level: string
      let color: string
      let action: string

      if (ratio >= 1.0) {
        level = "红色报警"
        color = "🔴"
        action = "立即启动应急预案，暂停施工，通知各方负责人到场处置"
      } else if (ratio >= 0.85) {
        level = "橙色预警"
        color = "🟠"
        action = "通知项目负责人和监理，加密监测频率至每日2次，加强人工巡视"
      } else if (ratio >= 0.70) {
        level = "黄色预警"
        color = "🟡"
        action = "加密监测频率，关注发展趋势，准备上报项目部"
      } else {
        level = "正常"
        color = "🟢"
        action = "按正常频率继续监测"
      }

      return JSON.stringify({
        point_id: args.pointId,
        cumulative_value_mm: args.cumulativeValue,
        alert_threshold_mm: args.alertThreshold,
        ratio_pct: Number((ratio * 100).toFixed(1)),
        level,
        color,
        action,
        message: `${color} ${args.pointId}：累计变化量 ${args.cumulativeValue}mm，占控制值比例 ${(ratio * 100).toFixed(1)}%，${level}。建议措施：${action}`,
      })
    },
  })
