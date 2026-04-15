/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

// ============================================================
// Tunnel / excavation cross-section analysis tools
// ============================================================

// ============================================================
// Tool: Convergence calculation from monitoring pairs
// ============================================================

export const convergence_calc = tool({
  description:
    "收敛量计算：根据隧道断面上对称测点对的坐标，计算净空收敛量（水平收敛、拱顶沉降等）。地铁隧道健康监测和施工监测中的核心分析工具。data_analyst 在处理隧道断面监测数据时必须调用此工具。",
  args: {
    sectionId: tool.schema.string().describe("断面编号"),
    chainage: tool.schema.string().optional().describe("里程桩号，如 K12+345.678"),
    initialPairs: tool.schema
      .array(
        tool.schema.object({
          pairId: tool.schema.string().describe("测点对编号，如 H1（水平收敛对1）"),
          pointA: tool.schema.object({
            x: tool.schema.number().describe("A点X坐标(m)"),
            y: tool.schema.number().describe("A点Y坐标(m)"),
          }),
          pointB: tool.schema.object({
            x: tool.schema.number().describe("B点X坐标(m)"),
            y: tool.schema.number().describe("B点Y坐标(m)"),
          }),
        }),
      )
      .min(1)
      .describe("初始观测（基准）的测点对坐标"),
    currentPairs: tool.schema
      .array(
        tool.schema.object({
          pairId: tool.schema.string().describe("测点对编号（与初始观测对应）"),
          pointA: tool.schema.object({
            x: tool.schema.number().describe("A点X坐标(m)"),
            y: tool.schema.number().describe("A点Y坐标(m)"),
          }),
          pointB: tool.schema.object({
            x: tool.schema.number().describe("B点X坐标(m)"),
            y: tool.schema.number().describe("B点Y坐标(m)"),
          }),
        }),
      )
      .min(1)
      .describe("本期观测的测点对坐标"),
    crownInitial: tool.schema.object({
      x: tool.schema.number().describe("拱顶X坐标(m)"),
      y: tool.schema.number().describe("拱顶Y坐标(m)"),
    }).optional().describe("拱顶初始坐标（若提供则计算拱顶沉降）"),
    crownCurrent: tool.schema.object({
      x: tool.schema.number().describe("拱顶X坐标(m)"),
      y: tool.schema.number().describe("拱顶Y坐标(m)"),
    }).optional().describe("拱顶本期坐标"),
    alertThreshold: tool.schema.number().positive().optional().describe("收敛报警值(mm)"),
  },
  async execute(args) {
    // Build initial pair map
    const initialMap = new Map(args.initialPairs.map((p) => [p.pairId, p]))

    const convergences = args.currentPairs.map((curr) => {
      const init = initialMap.get(curr.pairId)
      if (!init)
        return {
          pair_id: curr.pairId,
          error: `未找到对应的初始观测数据`,
        }

      const initDist = Math.sqrt(
        (init.pointB.x - init.pointA.x) ** 2 + (init.pointB.y - init.pointA.y) ** 2
      )
      const currDist = Math.sqrt(
        (curr.pointB.x - curr.pointA.x) ** 2 + (curr.pointB.y - curr.pointA.y) ** 2
      )
      const convergence = (initDist - currDist) * 1000 // mm, positive = converging
      const rate = initDist > 0 ? (convergence / (initDist * 1000)) * 100 : 0

      let status = "🟢 正常"
      if (args.alertThreshold) {
        const ratio = Math.abs(convergence) / args.alertThreshold
        if (ratio >= 1.0) status = "🔴 超限"
        else if (ratio >= 0.85) status = "🟠 接近阈值"
        else if (ratio >= 0.70) status = "🟡 关注"
      }

      return {
        pair_id: curr.pairId,
        initial_distance_m: Number(initDist.toFixed(4)),
        current_distance_m: Number(currDist.toFixed(4)),
        convergence_mm: Number(convergence.toFixed(3)),
        convergence_rate_pct: Number(rate.toFixed(4)),
        status,
      }
    })

    // Crown settlement
    let crownSettlement: Record<string, unknown> | undefined
    if (args.crownInitial && args.crownCurrent) {
      const dy = (args.crownCurrent.y - args.crownInitial.y) * 1000 // mm
      const dx = (args.crownCurrent.x - args.crownInitial.x) * 1000 // mm
      const total = Math.sqrt(dx * dx + dy * dy)

      let status = "🟢 正常"
      if (args.alertThreshold) {
        const ratio = Math.abs(dy) / args.alertThreshold
        if (ratio >= 1.0) status = "🔴 超限"
        else if (ratio >= 0.85) status = "🟠 接近阈值"
        else if (ratio >= 0.70) status = "🟡 关注"
      }

      crownSettlement = {
        vertical_mm: Number(dy.toFixed(3)),
        horizontal_mm: Number(dx.toFixed(3)),
        total_mm: Number(total.toFixed(3)),
        direction: dy < 0 ? "沉降" : "上抬",
        status,
      }
    }

    const maxConvergence = convergences
      .filter((c) => "convergence_mm" in c)
      .reduce(
        (max, c) => {
          const val = Math.abs((c as { convergence_mm: number }).convergence_mm)
          return val > max.value ? { pair_id: c.pair_id, value: val } : max
        },
        { pair_id: "", value: 0 },
      )

    return JSON.stringify({
      section_id: args.sectionId,
      chainage: args.chainage ?? "未指定",
      convergences,
      crown_settlement: crownSettlement,
      max_convergence: {
        pair_id: maxConvergence.pair_id,
        value_mm: maxConvergence.value,
      },
      message: `✅ 断面 ${args.sectionId} 收敛分析完成：最大收敛 ${maxConvergence.pair_id}(${maxConvergence.value.toFixed(3)}mm)${crownSettlement ? `，拱顶${(crownSettlement as { direction: string }).direction} ${Math.abs(crownSettlement.vertical_mm as number).toFixed(3)}mm` : ""}`,
    })
  },
})

// ============================================================
// Tool: Cross-section profile comparison
// ============================================================

export const profile_comparison = tool({
  description:
    "断面轮廓对比分析：将隧道/基坑实测断面轮廓与设计轮廓进行对比，计算各点的超欠挖量和净空余量。适用于隧道开挖断面检测、盾构管片姿态分析。",
  args: {
    sectionId: tool.schema.string().describe("断面编号"),
    designProfile: tool.schema
      .array(
        tool.schema.object({
          angle: tool.schema.number().describe("从拱顶顺时针方向的角度(度)，0=拱顶，180=仰拱"),
          radius: tool.schema.number().positive().describe("设计半径/距中心距离(m)"),
        }),
      )
      .min(3)
      .describe("设计断面轮廓（极坐标表示：角度+半径）"),
    measuredProfile: tool.schema
      .array(
        tool.schema.object({
          angle: tool.schema.number().describe("测量方向角(度)"),
          radius: tool.schema.number().positive().describe("实测距中心距离(m)"),
        }),
      )
      .min(3)
      .describe("实测断面轮廓"),
    overbreakLimit: tool.schema.number().positive().default(150).describe("允许超挖限值(mm)，默认150mm"),
    underbreakLimit: tool.schema.number().positive().default(0).describe("允许欠挖限值(mm)，默认0mm（不允许欠挖）"),
  },
  async execute(args) {
    // Sort design profile by angle for interpolation
    const design = [...args.designProfile].sort((a, b) => a.angle - b.angle)

    // Interpolate design radius at given angle
    function designRadius(angle: number): number {
      const normAngle = ((angle % 360) + 360) % 360
      for (let i = 0; i < design.length - 1; i++) {
        if (normAngle >= design[i]!.angle && normAngle <= design[i + 1]!.angle) {
          const ratio = (normAngle - design[i]!.angle) / (design[i + 1]!.angle - design[i]!.angle)
          return design[i]!.radius + ratio * (design[i + 1]!.radius - design[i]!.radius)
        }
      }
      // Wrap around or nearest
      return design[0]!.radius
    }

    const comparisons = args.measuredProfile.map((m) => {
      const dRadius = designRadius(m.angle)
      const diff = (m.radius - dRadius) * 1000 // mm, positive = overbreak
      const isOverbreak = diff > 0
      const isUnderbreak = diff < 0

      let status = "🟢 合格"
      if (isOverbreak && diff > args.overbreakLimit) {
        status = "🔴 超挖超限"
      } else if (isUnderbreak && Math.abs(diff) > args.underbreakLimit) {
        status = "🔴 欠挖"
      } else if (isOverbreak) {
        status = "🟡 超挖（限内）"
      }

      return {
        angle_deg: m.angle,
        design_radius_m: Number(dRadius.toFixed(4)),
        measured_radius_m: Number(m.radius.toFixed(4)),
        deviation_mm: Number(diff.toFixed(1)),
        type: isOverbreak ? "超挖" : isUnderbreak ? "欠挖" : "吻合",
        status,
      }
    })

    const overbreakPoints = comparisons.filter((c) => c.type === "超挖")
    const underbreakPoints = comparisons.filter((c) => c.type === "欠挖")
    const maxOverbreak = overbreakPoints.length > 0
      ? overbreakPoints.reduce((max, c) => c.deviation_mm > max.deviation_mm ? c : max, overbreakPoints[0]!)
      : null
    const maxUnderbreak = underbreakPoints.length > 0
      ? underbreakPoints.reduce((max, c) => Math.abs(c.deviation_mm) > Math.abs(max.deviation_mm) ? c : max, underbreakPoints[0]!)
      : null

    const avgDeviation = comparisons.reduce((s, c) => s + c.deviation_mm, 0) / comparisons.length
    const failCount = comparisons.filter((c) => c.status.includes("超限") || c.status.includes("欠挖")).length

    return JSON.stringify({
      section_id: args.sectionId,
      measured_points: comparisons.length,
      overbreak_count: overbreakPoints.length,
      underbreak_count: underbreakPoints.length,
      fail_count: failCount,
      average_deviation_mm: Number(avgDeviation.toFixed(1)),
      max_overbreak: maxOverbreak ? {
        angle_deg: maxOverbreak.angle_deg,
        deviation_mm: maxOverbreak.deviation_mm,
      } : null,
      max_underbreak: maxUnderbreak ? {
        angle_deg: maxUnderbreak.angle_deg,
        deviation_mm: maxUnderbreak.deviation_mm,
      } : null,
      details: comparisons,
      assessment: failCount === 0
        ? `✅ 断面 ${args.sectionId} 开挖轮廓合格：${overbreakPoints.length}处超挖均在限值内，无欠挖`
        : `❌ 断面 ${args.sectionId} 有 ${failCount} 处不合格（超挖超限或欠挖），需处理`,
      message: `断面 ${args.sectionId}：${comparisons.length}个测点，超挖 ${overbreakPoints.length}处，欠挖 ${underbreakPoints.length}处，${failCount === 0 ? "全部合格" : `${failCount}处不合格`}`,
    })
  },
})

// ============================================================
// Tool: Section clearance check
// ============================================================

export const clearance_check = tool({
  description:
    "限界（建筑净空）检查：对比隧道实测断面与限界要求，判断是否侵入建筑限界。运营隧道健康监测中用于结构变形是否影响行车安全的关键判定。",
  args: {
    sectionId: tool.schema.string().describe("断面编号"),
    gaugeProfile: tool.schema
      .array(
        tool.schema.object({
          angle: tool.schema.number().describe("方向角(度)"),
          minRadius: tool.schema.number().positive().describe("该方向上的最小净空要求(m)"),
        }),
      )
      .min(3)
      .describe("限界轮廓（极坐标，定义各方向最小净空）"),
    measuredProfile: tool.schema
      .array(
        tool.schema.object({
          angle: tool.schema.number().describe("测量方向角(度)"),
          radius: tool.schema.number().positive().describe("实测距中心距离(m)"),
        }),
      )
      .min(3)
      .describe("实测断面轮廓"),
    safetyMargin: tool.schema.number().default(50).describe("安全余量(mm)，低于此值发出预警，默认50mm"),
  },
  async execute(args) {
    const gauge = [...args.gaugeProfile].sort((a, b) => a.angle - b.angle)

    function gaugeRadius(angle: number): number {
      const norm = ((angle % 360) + 360) % 360
      for (let i = 0; i < gauge.length - 1; i++) {
        if (norm >= gauge[i]!.angle && norm <= gauge[i + 1]!.angle) {
          const ratio = (norm - gauge[i]!.angle) / (gauge[i + 1]!.angle - gauge[i]!.angle)
          return gauge[i]!.minRadius + ratio * (gauge[i + 1]!.minRadius - gauge[i]!.minRadius)
        }
      }
      return gauge[0]!.minRadius
    }

    const checks = args.measuredProfile.map((m) => {
      const minR = gaugeRadius(m.angle)
      const margin = (m.radius - minR) * 1000 // mm

      let status: string
      if (margin < 0) {
        status = "🔴 侵入限界"
      } else if (margin < args.safetyMargin) {
        status = "🟠 余量不足"
      } else {
        status = "🟢 合格"
      }

      return {
        angle_deg: m.angle,
        gauge_min_radius_m: Number(minR.toFixed(4)),
        measured_radius_m: Number(m.radius.toFixed(4)),
        margin_mm: Number(margin.toFixed(1)),
        status,
      }
    })

    const violations = checks.filter((c) => c.margin_mm < 0)
    const warnings = checks.filter((c) => c.margin_mm >= 0 && c.margin_mm < args.safetyMargin)
    const minMargin = checks.reduce((min, c) => c.margin_mm < min.margin_mm ? c : min, checks[0]!)

    return JSON.stringify({
      section_id: args.sectionId,
      total_points: checks.length,
      violations: violations.length,
      warnings: warnings.length,
      min_margin: {
        angle_deg: minMargin.angle_deg,
        margin_mm: minMargin.margin_mm,
        status: minMargin.status,
      },
      details: checks,
      assessment: violations.length > 0
        ? `🔴 断面 ${args.sectionId} 有 ${violations.length} 处侵入建筑限界！最小余量 ${minMargin.margin_mm.toFixed(1)}mm（${minMargin.angle_deg}°方向），必须立即处理！`
        : warnings.length > 0
        ? `🟠 断面 ${args.sectionId} 有 ${warnings.length} 处净空余量不足 ${args.safetyMargin}mm，需密切关注`
        : `✅ 断面 ${args.sectionId} 建筑限界检查通过，最小余量 ${minMargin.margin_mm.toFixed(1)}mm`,
      message: `限界检查 ${args.sectionId}：${violations.length > 0 ? `🔴 ${violations.length}处侵限` : warnings.length > 0 ? `🟠 ${warnings.length}处余量不足` : "✅ 全部通过"}，最小余量 ${minMargin.margin_mm.toFixed(1)}mm`,
    })
  },
})
