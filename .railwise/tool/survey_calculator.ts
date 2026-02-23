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

// ============================================================
// Matrix utilities for least squares adjustment
// ============================================================

type Matrix = number[][]

const mat = {
  zeros: (r: number, c: number): Matrix =>
    Array.from({ length: r }, () => Array(c).fill(0) as number[]),

  transpose: (a: Matrix): Matrix =>
    a[0]!.map((_, j) => a.map((row) => row[j]!)),

  mul: (a: Matrix, b: Matrix): Matrix =>
    a.map((row) =>
      b[0]!.map((_, j) =>
        row.reduce((sum, val, k) => sum + val * b[k]![j]!, 0),
      ),
    ),

  mulVec: (a: Matrix, v: number[]): number[] =>
    a.map((row) => row.reduce((sum, val, k) => sum + val * v[k]!, 0)),

  invert: (src: Matrix): Matrix | null => {
    const n = src.length
    const aug = src.map((row, i) => [
      ...row,
      ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
    ])
    for (let col = 0; col < n; col++) {
      let pivotRow = col
      for (let row = col + 1; row < n; row++) {
        if (Math.abs(aug[row]![col]!) > Math.abs(aug[pivotRow]![col]!))
          pivotRow = row
      }
      if (Math.abs(aug[pivotRow]![col]!) < 1e-15) return null
      ;[aug[col], aug[pivotRow]] = [aug[pivotRow]!, aug[col]!]
      const pivot = aug[col]![col]!
      for (let j = col; j < 2 * n; j++) aug[col]![j]! /= pivot
      for (let row = 0; row < n; row++) {
        if (row === col) continue
        const factor = aug[row]![col]!
        for (let j = col; j < 2 * n; j++)
          aug[row]![j]! -= factor * aug[col]![j]!
      }
    }
    return aug.map((row) => row.slice(n))
  },
}

// ============================================================
// Leveling network least squares adjustment
// ============================================================

export const leveling_adjustment = tool({
  description:
    "水准网严密平差（最小二乘法）。输入已知基准点高程和观测的高差数据，返回平差后高程、残差、单位权中误差及各点精度评定。data_analyst 在处理完闭合差校核后，需要严密计算时必须调用此工具。",
  args: {
    benchmarks: tool.schema
      .array(
        tool.schema.object({
          id: tool.schema.string().describe("基准点编号"),
          height: tool.schema.number().describe("已知高程(m)"),
        }),
      )
      .min(1)
      .describe("已知高程的基准点列表（至少1个）"),
    observations: tool.schema
      .array(
        tool.schema.object({
          from: tool.schema.string().describe("后视点编号"),
          to: tool.schema.string().describe("前视点编号"),
          heightDiff: tool.schema.number().describe("观测高差(m)，from→to方向为正"),
          routeLength: tool.schema.number().positive().describe("该测段路线长度(km)"),
        }),
      )
      .min(1)
      .describe("所有观测高差数据"),
    order: tool.schema
      .enum(["1st", "2nd", "3rd", "4th", "city-2nd"])
      .default("4th")
      .describe("测量等级，用于精度评定对比"),
  },
  async execute(args) {
    const knownMap = new Map(args.benchmarks.map((b) => [b.id, b.height]))
    const unknownIds = [
      ...new Set(
        args.observations
          .flatMap((o) => [o.from, o.to])
          .filter((id) => !knownMap.has(id)),
      ),
    ]
    const u = unknownIds.length
    const n = args.observations.length

    if (u === 0)
      return JSON.stringify({ error: "所有点均为已知点，无需平差。" })
    if (n < u)
      return JSON.stringify({
        error: `观测数 ${n} 少于未知数 ${u}，无法进行平差。需要至少 ${u} 个观测值。`,
      })

    const idxOf = (id: string) => unknownIds.indexOf(id)

    // Build coefficient matrix A, weight matrix P, observation vector L
    const A = mat.zeros(n, u)
    const P = mat.zeros(n, n)
    const L: number[] = []

    for (let i = 0; i < n; i++) {
      const obs = args.observations[i]!
      const fromIdx = idxOf(obs.from)
      const toIdx = idxOf(obs.to)

      // A matrix: h_to - h_from = heightDiff
      if (fromIdx >= 0) A[i]![fromIdx] = -1
      if (toIdx >= 0) A[i]![toIdx] = 1

      // Weight = 1/routeLength (proportional to inverse of distance)
      P[i]![i] = 1 / obs.routeLength

      // L = observed - computed from known values
      const fromH = knownMap.get(obs.from) ?? 0
      const toH = knownMap.get(obs.to) ?? 0
      L.push(obs.heightDiff - (toH - fromH))
    }

    // Normal equation: N = A^T P A, b = A^T P L
    const AT = mat.transpose(A)
    const ATP = mat.mul(AT, P)
    const N = mat.mul(ATP, A)
    const b = mat.mulVec(ATP, L)

    const Qxx = mat.invert(N)
    if (!Qxx)
      return JSON.stringify({ error: "法方程系数矩阵奇异，无法求解。请检查网形是否连通。" })

    // Solve: X = Qxx * b
    const X = mat.mulVec(Qxx, b)

    // Residuals: V = A*X - L
    const AX = mat.mulVec(A, X)
    const V = AX.map((v, i) => v - L[i]!)

    // Unit weight RMSE: σ₀ = sqrt(V^T P V / (n - u))
    const VTPV = V.reduce((sum, v, i) => sum + v * P[i]![i]! * v, 0)
    const redundancy = n - u
    const sigma0 = redundancy > 0 ? Math.sqrt(VTPV / redundancy) : 0

    // Point height RMSE: σ_i = σ₀ * sqrt(Q_ii)
    const adjusted = unknownIds.map((id, i) => {
      const approxH = knownMap.get(id) ?? 0
      const correction = X[i]!
      const height = approxH + correction
      const rmse = sigma0 * Math.sqrt(Math.abs(Qxx[i]![i]!))
      return {
        point_id: id,
        adjusted_height_m: Number(height.toFixed(4)),
        correction_mm: Number((correction * 1000).toFixed(3)),
        rmse_mm: Number((rmse * 1000).toFixed(3)),
      }
    })

    const residuals = args.observations.map((obs, i) => ({
      from: obs.from,
      to: obs.to,
      observed_mm: Number((obs.heightDiff * 1000).toFixed(3)),
      residual_mm: Number((V[i]! * 1000).toFixed(3)),
    }))

    const spec = LEVELING_LIMITS[args.order]!
    const maxRmse = Math.max(...adjusted.map((a) => a.rmse_mm))

    return JSON.stringify({
      method: "最小二乘法严密平差",
      known_points: args.benchmarks.length,
      unknown_points: u,
      observations: n,
      redundancy,
      unit_weight_rmse_mm: Number((sigma0 * 1000).toFixed(3)),
      order_desc: spec.desc,
      max_point_rmse_mm: maxRmse,
      adjusted_heights: adjusted,
      residuals,
      assessment:
        sigma0 * 1000 < spec.k
          ? `✅ 单位权中误差 ${(sigma0 * 1000).toFixed(3)}mm < ${spec.k}mm（${spec.desc}限差系数），精度合格`
          : `⚠️ 单位权中误差 ${(sigma0 * 1000).toFixed(3)}mm ≥ ${spec.k}mm（${spec.desc}限差系数），建议检查观测质量`,
    })
  },
})

// ============================================================
// Traverse network coordinate adjustment
// ============================================================

const deg2rad = (d: number) => (d * Math.PI) / 180

export const traverse_adjustment = tool({
  description:
    "附合导线/闭合导线坐标平差计算。输入起始点坐标、起始方位角、各站观测角和边长，返回平差后坐标、闭合差分析及各点精度。data_analyst 在处理导线测量数据时必须调用此工具。",
  args: {
    startPoint: tool.schema.object({
      id: tool.schema.string().describe("起始点编号"),
      x: tool.schema.number().describe("起始点X坐标（东方向/m）"),
      y: tool.schema.number().describe("起始点Y坐标（北方向/m）"),
    }).describe("起始已知点"),
    endPoint: tool.schema.object({
      id: tool.schema.string().describe("终止点编号"),
      x: tool.schema.number().describe("终止点X坐标（东方向/m）"),
      y: tool.schema.number().describe("终止点Y坐标（北方向/m）"),
    }).describe("终止已知点（附合导线需要；闭合导线与起始点相同）"),
    startAzimuth: tool.schema.number().describe("起始边方位角（度，十进制）"),
    endAzimuth: tool.schema.number().describe("终止边方位角（度，十进制）；闭合导线传起始方位角"),
    stations: tool.schema
      .array(
        tool.schema.object({
          id: tool.schema.string().describe("转折点编号"),
          angle: tool.schema.number().describe("观测的左角/转折角（度，十进制）"),
          distance: tool.schema.number().positive().describe("该站到下一站的边长(m)"),
        }),
      )
      .min(1)
      .describe("各导线测站观测数据（按测量顺序排列）"),
    instrument: tool.schema
      .enum(["DJ1", "DJ2", "DJ6"])
      .default("DJ2")
      .describe("经纬仪等级"),
  },
  async execute(args) {
    const n = args.stations.length
    const angSpec = TRAVERSE_ANGULAR_LIMITS[args.instrument]!

    // Step 1: Angular closure
    const sumAngles = args.stations.reduce((s, st) => s + st.angle, 0)
    const theoreticalSum = ((args.endAzimuth - args.startAzimuth + 180 * n) % 360 + 360) % 360
    const angularClosure = sumAngles - theoreticalSum
    const normalized =
      angularClosure > 180 ? angularClosure - 360
      : angularClosure < -180 ? angularClosure + 360
      : angularClosure
    const closureSec = normalized * 3600
    const angLimit = angSpec.k * Math.sqrt(n)

    if (Math.abs(closureSec) > angLimit)
      return JSON.stringify({
        error: `角度闭合差 ${closureSec.toFixed(1)}″ 超出限差 ±${angLimit.toFixed(1)}″（${angSpec.desc}），请先返工重测角度。`,
        angular_closure_arcsec: Number(closureSec.toFixed(1)),
        angular_limit_arcsec: Number(angLimit.toFixed(1)),
      })

    // Step 2: Distribute angular error equally
    const corr = -normalized / n
    const azimuths: number[] = []
    let az = args.startAzimuth
    for (const st of args.stations) {
      az = ((az + st.angle + corr + 180) % 360 + 360) % 360
      azimuths.push(az)
    }

    // Step 3: Compute provisional coordinates
    const totalDist = args.stations.reduce((s, st) => s + st.distance, 0)
    const dxArr = args.stations.map((st, i) => st.distance * Math.sin(deg2rad(azimuths[i]!)))
    const dyArr = args.stations.map((st, i) => st.distance * Math.cos(deg2rad(azimuths[i]!)))

    const sumDx = dxArr.reduce((a, b) => a + b, 0)
    const sumDy = dyArr.reduce((a, b) => a + b, 0)
    const fx = sumDx - (args.endPoint.x - args.startPoint.x)
    const fy = sumDy - (args.endPoint.y - args.startPoint.y)
    const closureDist = Math.sqrt(fx * fx + fy * fy)
    const relClosure = totalDist > 0 ? totalDist / closureDist : Infinity

    // Step 4: Distribute coordinate closure proportionally
    const coords: Array<{ id: string; x: number; y: number }> = []
    let cumDist = 0

    for (let i = 0; i < n; i++) {
      cumDist += args.stations[i]!.distance
      const ratio = cumDist / totalDist
      const cx = args.startPoint.x + dxArr.slice(0, i + 1).reduce((a, b) => a + b, 0) - fx * ratio
      const cy = args.startPoint.y + dyArr.slice(0, i + 1).reduce((a, b) => a + b, 0) - fy * ratio
      coords.push({ id: args.stations[i]!.id, x: Number(cx.toFixed(4)), y: Number(cy.toFixed(4)) })
    }

    const pointRmse = closureDist / Math.sqrt(3 * n)

    return JSON.stringify({
      method: "附合导线简易平差（角度等权分配，坐标按边长比例分配）",
      station_count: n,
      total_distance_m: Number(totalDist.toFixed(3)),
      angular_closure: {
        measured_arcsec: Number(closureSec.toFixed(1)),
        limit_arcsec: Number(angLimit.toFixed(1)),
        correction_per_station_arcsec: Number((corr * 3600).toFixed(2)),
        is_passed: true,
      },
      coordinate_closure: {
        fx_m: Number(fx.toFixed(4)),
        fy_m: Number(fy.toFixed(4)),
        closure_distance_m: Number(closureDist.toFixed(4)),
        relative_closure: `1/${Math.round(relClosure)}`,
        assessment:
          relClosure >= 10000 ? "✅ 优秀（全长相对闭合差 < 1/10000）"
          : relClosure >= 4000 ? "✅ 良好（全长相对闭合差 < 1/4000）"
          : relClosure >= 2000 ? "⚠️ 一般（全长相对闭合差 < 1/2000），建议复查"
          : "❌ 不合格，需返工重测",
      },
      adjusted_coordinates: coords,
      azimuths_deg: azimuths.map((a, i) => ({
        from: i === 0 ? args.startPoint.id : args.stations[i - 1]!.id,
        to: args.stations[i]!.id,
        azimuth: Number(a.toFixed(6)),
      })),
      point_rmse_mm: Number((pointRmse * 1000).toFixed(2)),
    })
  },
})
