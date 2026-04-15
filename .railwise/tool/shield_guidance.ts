/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

const deg2rad = (d: number) => (d * Math.PI) / 180
const rad2deg = (r: number) => (r * 180) / Math.PI

export const shield_position = tool({
  description:
    "盾构机姿态计算。根据盾构机头部和尾部的实测坐标，计算盾构机当前中心坐标、方位角、俯仰角、滚转角，与设计轴线对比计算偏差。盾构导向测量的核心计算工具。data_analyst 处理盾构导向数据时必须调用此工具。",
  args: {
    ringNumber: tool.schema.number().int().positive().describe("当前环号"),
    chainage: tool.schema.string().optional().describe("当前里程，如 K5+123.456"),
    headPosition: tool.schema.object({
      x: tool.schema.number().describe("盾头中心X坐标(m)"),
      y: tool.schema.number().describe("盾头中心Y坐标(m)"),
      z: tool.schema.number().describe("盾头中心高程(m)"),
    }).describe("盾构机头部测量坐标"),
    tailPosition: tool.schema.object({
      x: tool.schema.number().describe("盾尾中心X坐标(m)"),
      y: tool.schema.number().describe("盾尾中心Y坐标(m)"),
      z: tool.schema.number().describe("盾尾中心高程(m)"),
    }).describe("盾构机尾部测量坐标"),
    designAxis: tool.schema.object({
      x: tool.schema.number().describe("设计轴线该里程处X坐标(m)"),
      y: tool.schema.number().describe("设计轴线该里程处Y坐标(m)"),
      z: tool.schema.number().describe("设计轴线该里程处高程(m)"),
      azimuth: tool.schema.number().describe("设计方位角(度)"),
      grade: tool.schema.number().describe("设计纵坡(‰)"),
    }).describe("设计轴线参数"),
    shieldLength: tool.schema.number().positive().default(8.7).describe("盾构机总长(m)，默认8.7m"),
    horizontalLimit: tool.schema.number().positive().default(50).describe("水平偏差报警值(mm)"),
    verticalLimit: tool.schema.number().positive().default(50).describe("垂直偏差报警值(mm)"),
  },
  async execute(args) {
    const head = args.headPosition
    const tail = args.tailPosition

    // Shield center = midpoint of head and tail
    const center = {
      x: (head.x + tail.x) / 2,
      y: (head.y + tail.y) / 2,
      z: (head.z + tail.z) / 2,
    }

    // Shield azimuth (horizontal plane)
    const dx = head.x - tail.x
    const dy = head.y - tail.y
    const dz = head.z - tail.z
    const horizontalDist = Math.sqrt(dx * dx + dy * dy)
    const shieldAzimuth = ((Math.atan2(dx, dy) * 180) / Math.PI + 360) % 360

    // Pitch angle (vertical plane, positive = upward)
    const pitchAngle = Math.atan2(dz, horizontalDist) * 180 / Math.PI

    // Shield grade in ‰
    const shieldGrade = horizontalDist > 0 ? (dz / horizontalDist) * 1000 : 0

    // Deviations from design axis
    const da = args.designAxis
    const designAzRad = deg2rad(da.azimuth)

    // Horizontal deviation: perpendicular distance from center to design line
    const relX = center.x - da.x
    const relY = center.y - da.y
    const horizontalDev = (relX * Math.cos(designAzRad) - relY * Math.sin(designAzRad)) * 1000

    // Vertical deviation
    const verticalDev = (center.z - da.z) * 1000

    // Azimuth deviation
    let azimuthDev = shieldAzimuth - da.azimuth
    if (azimuthDev > 180) azimuthDev -= 360
    if (azimuthDev < -180) azimuthDev += 360

    // Grade deviation
    const gradeDev = shieldGrade - da.grade

    // Head deviations (for trend analysis)
    const headRelX = head.x - da.x
    const headRelY = head.y - da.y
    const headHDev = (headRelX * Math.cos(designAzRad) - headRelY * Math.sin(designAzRad)) * 1000
    const headVDev = (head.z - da.z) * 1000

    // Tail deviations
    const tailRelX = tail.x - da.x
    const tailRelY = tail.y - da.y
    const tailHDev = (tailRelX * Math.cos(designAzRad) - tailRelY * Math.sin(designAzRad)) * 1000
    const tailVDev = (tail.z - da.z) * 1000

    // Trend: if head deviates more than tail, shield is moving away from axis
    const hTrend = Math.abs(headHDev) > Math.abs(tailHDev) ? "偏离" : "回归"
    const vTrend = Math.abs(headVDev) > Math.abs(tailVDev) ? "偏离" : "回归"

    let hStatus = "🟢 正常"
    if (Math.abs(horizontalDev) >= args.horizontalLimit) hStatus = "🔴 超限"
    else if (Math.abs(horizontalDev) >= args.horizontalLimit * 0.7) hStatus = "🟡 关注"

    let vStatus = "🟢 正常"
    if (Math.abs(verticalDev) >= args.verticalLimit) vStatus = "🔴 超限"
    else if (Math.abs(verticalDev) >= args.verticalLimit * 0.7) vStatus = "🟡 关注"

    const hDirection = horizontalDev > 0 ? "偏右" : horizontalDev < 0 ? "偏左" : "居中"
    const vDirection = verticalDev > 0 ? "偏高" : verticalDev < 0 ? "偏低" : "居中"

    return JSON.stringify({
      ring_number: args.ringNumber,
      chainage: args.chainage ?? "未指定",
      shield_center: {
        x: Number(center.x.toFixed(4)),
        y: Number(center.y.toFixed(4)),
        z: Number(center.z.toFixed(4)),
      },
      shield_attitude: {
        azimuth_deg: Number(shieldAzimuth.toFixed(6)),
        pitch_deg: Number(pitchAngle.toFixed(4)),
        grade_permille: Number(shieldGrade.toFixed(2)),
      },
      deviation: {
        horizontal_mm: Number(horizontalDev.toFixed(1)),
        horizontal_direction: hDirection,
        horizontal_status: hStatus,
        vertical_mm: Number(verticalDev.toFixed(1)),
        vertical_direction: vDirection,
        vertical_status: vStatus,
        azimuth_deviation_deg: Number(azimuthDev.toFixed(4)),
        grade_deviation_permille: Number(gradeDev.toFixed(2)),
      },
      head_deviation: {
        horizontal_mm: Number(headHDev.toFixed(1)),
        vertical_mm: Number(headVDev.toFixed(1)),
      },
      tail_deviation: {
        horizontal_mm: Number(tailHDev.toFixed(1)),
        vertical_mm: Number(tailVDev.toFixed(1)),
      },
      trend: {
        horizontal: hTrend,
        vertical: vTrend,
      },
      message: `✅ 第${args.ringNumber}环姿态：水平${hDirection} ${Math.abs(horizontalDev).toFixed(1)}mm(${hStatus})，垂直${vDirection} ${Math.abs(verticalDev).toFixed(1)}mm(${vStatus})，趋势：水平${hTrend}、垂直${vTrend}`,
    })
  },
})

export const shield_trend = tool({
  description:
    "盾构掘进偏差趋势分析。输入多环的偏差数据，分析偏差发展趋势，预测未来偏差，为纠偏决策提供依据。",
  args: {
    records: tool.schema
      .array(
        tool.schema.object({
          ring: tool.schema.number().int().positive().describe("环号"),
          horizontalDev: tool.schema.number().describe("水平偏差(mm)，正=偏右"),
          verticalDev: tool.schema.number().describe("垂直偏差(mm)，正=偏高"),
        }),
      )
      .min(3)
      .describe("多环偏差数据，按环号排列"),
    horizontalLimit: tool.schema.number().positive().default(50).describe("水平限值(mm)"),
    verticalLimit: tool.schema.number().positive().default(50).describe("垂直限值(mm)"),
    predictionRings: tool.schema.number().int().positive().default(10).describe("预测环数"),
  },
  async execute(args) {
    const n = args.records.length
    const rings = args.records.map((r) => r.ring)
    const hDevs = args.records.map((r) => r.horizontalDev)
    const vDevs = args.records.map((r) => r.verticalDev)

    function linReg(x: number[], y: number[]) {
      const mx = x.reduce((s, v) => s + v, 0) / n
      const my = y.reduce((s, v) => s + v, 0) / n
      const sxy = x.reduce((s, v, i) => s + (v - mx) * (y[i]! - my), 0)
      const sxx = x.reduce((s, v) => s + (v - mx) * (v - mx), 0)
      const b = sxx > 0 ? sxy / sxx : 0
      const a = my - b * mx
      return { a, b }
    }

    const hReg = linReg(rings, hDevs)
    const vReg = linReg(rings, vDevs)

    const lastRing = rings[n - 1]!
    const hPredictions = Array.from({ length: args.predictionRings }, (_, i) => {
      const r = lastRing + i + 1
      return { ring: r, predicted_mm: Number((hReg.a + hReg.b * r).toFixed(1)) }
    })
    const vPredictions = Array.from({ length: args.predictionRings }, (_, i) => {
      const r = lastRing + i + 1
      return { ring: r, predicted_mm: Number((vReg.a + vReg.b * r).toFixed(1)) }
    })

    // Rings until exceeding limit
    const hRingsToLimit = hReg.b !== 0
      ? Math.ceil((args.horizontalLimit * Math.sign(hReg.b) - hReg.a) / hReg.b) - lastRing
      : Infinity
    const vRingsToLimit = vReg.b !== 0
      ? Math.ceil((args.verticalLimit * Math.sign(vReg.b) - vReg.a) / vReg.b) - lastRing
      : Infinity

    const latestH = hDevs[n - 1]!
    const latestV = vDevs[n - 1]!

    // Rate per ring (last 5)
    const recent = Math.min(5, n - 1)
    const hRate = (hDevs[n - 1]! - hDevs[n - 1 - recent]!) / recent
    const vRate = (vDevs[n - 1]! - vDevs[n - 1 - recent]!) / recent

    let recommendation = ""
    if (Math.abs(latestH) > args.horizontalLimit * 0.7 && Math.abs(hRate) > 1) {
      recommendation += `水平方向需向${latestH > 0 ? "左" : "右"}纠偏；`
    }
    if (Math.abs(latestV) > args.verticalLimit * 0.7 && Math.abs(vRate) > 1) {
      recommendation += `垂直方向需向${latestV > 0 ? "下" : "上"}纠偏；`
    }
    if (!recommendation) recommendation = "当前偏差可控，保持掘进"

    return JSON.stringify({
      analysis_range: `第${rings[0]}环 ~ 第${lastRing}环`,
      latest: {
        ring: lastRing,
        horizontal_mm: latestH,
        vertical_mm: latestV,
      },
      rate_per_ring: {
        horizontal_mm: Number(hRate.toFixed(2)),
        vertical_mm: Number(vRate.toFixed(2)),
      },
      trend: {
        horizontal_slope: Number(hReg.b.toFixed(4)),
        vertical_slope: Number(vReg.b.toFixed(4)),
      },
      horizontal_predictions: hPredictions,
      vertical_predictions: vPredictions,
      rings_to_horizontal_limit: hRingsToLimit > 0 && isFinite(hRingsToLimit) ? hRingsToLimit : "不会超限",
      rings_to_vertical_limit: vRingsToLimit > 0 && isFinite(vRingsToLimit) ? vRingsToLimit : "不会超限",
      recommendation,
      message: `✅ 盾构偏差趋势（${rings[0]}~${lastRing}环）：水平 ${latestH}mm（速率${hRate.toFixed(2)}mm/环），垂直 ${latestV}mm（速率${vRate.toFixed(2)}mm/环）。${recommendation}`,
    })
  },
})

export const shield_ring_build = tool({
  description:
    "管片选型与拼装角度计算。根据盾构机当前姿态偏差和设计线路曲率，推算下一环管片的旋转角（楔形量方向），辅助管片选型决策。",
  args: {
    ringNumber: tool.schema.number().int().positive().describe("待拼装环号"),
    horizontalDev: tool.schema.number().describe("当前水平偏差(mm)，正=偏右"),
    verticalDev: tool.schema.number().describe("当前垂直偏差(mm)，正=偏高"),
    horizontalRate: tool.schema.number().describe("水平偏差速率(mm/环)"),
    verticalRate: tool.schema.number().describe("垂直偏差速率(mm/环)"),
    designCurveRadius: tool.schema.number().optional().describe("设计曲线半径(m)，直线段不传"),
    curveDirection: tool.schema
      .enum(["left", "right"])
      .optional()
      .describe("曲线方向：left=左转, right=右转"),
    wedgeAmount: tool.schema.number().positive().default(38).describe("楔形管片最大楔形量(mm)，默认38mm"),
    segmentTypes: tool.schema
      .array(tool.schema.string())
      .default(["A", "B", "C"])
      .describe("可选管片类型"),
  },
  async execute(args) {
    // Target correction direction
    const targetH = -Math.sign(args.horizontalDev + args.horizontalRate * 3)
    const targetV = -Math.sign(args.verticalDev + args.verticalRate * 3)

    // Rotation angle of wedge ring (0°=top, clockwise)
    // Map (targetH, targetV) to angle: right correction = 90°, down = 180°, left = 270°, up = 0°
    let rotationAngle = Math.atan2(targetH, -targetV) * 180 / Math.PI
    rotationAngle = ((rotationAngle % 360) + 360) % 360

    // Curve compensation
    let curveNote = ""
    if (args.designCurveRadius && args.curveDirection) {
      const curveCorrection = args.curveDirection === "left" ? 270 : 90
      const blendFactor = 0.3
      rotationAngle = rotationAngle * (1 - blendFactor) + curveCorrection * blendFactor
      rotationAngle = ((rotationAngle % 360) + 360) % 360
      curveNote = `曲线段(R=${args.designCurveRadius}m ${args.curveDirection === "left" ? "左转" : "右转"})，已叠加曲线补偿`
    }

    // Determine segment type
    const deviationMag = Math.sqrt(args.horizontalDev ** 2 + args.verticalDev ** 2)
    const rateMag = Math.sqrt(args.horizontalRate ** 2 + args.verticalRate ** 2)

    let recommendedType: string
    let useWedge: boolean
    if (deviationMag < 20 && rateMag < 2) {
      recommendedType = "标准环"
      useWedge = false
    } else {
      recommendedType = "楔形环（纠偏）"
      useWedge = true
    }

    return JSON.stringify({
      ring_number: args.ringNumber,
      current_deviation: {
        horizontal_mm: args.horizontalDev,
        vertical_mm: args.verticalDev,
        magnitude_mm: Number(deviationMag.toFixed(1)),
      },
      recommendation: {
        segment_type: recommendedType,
        use_wedge: useWedge,
        rotation_angle_deg: Number(rotationAngle.toFixed(1)),
        wedge_amount_mm: useWedge ? args.wedgeAmount : 0,
        correction_direction: `水平${targetH > 0 ? "向右" : "向左"}、垂直${targetV > 0 ? "向上" : "向下"}`,
      },
      curve_note: curveNote || undefined,
      message: `✅ 第${args.ringNumber}环建议：${recommendedType}，楔形量方向 ${rotationAngle.toFixed(1)}°${curveNote ? `（${curveNote}）` : ""}`,
    })
  },
})
