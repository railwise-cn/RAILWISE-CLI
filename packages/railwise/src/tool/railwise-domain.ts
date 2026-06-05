import path from "path"
import * as fs from "fs/promises"
import z from "zod"
import * as XLSX from "xlsx"
import { Instance } from "../project/instance"
import { Filesystem } from "../util/filesystem"
import { assertExternalDirectory } from "./external-directory"
import { Tool } from "./tool"

const read = z.object({
  path: z.string().optional().describe("Directory or file path to inspect. Defaults to the current workspace."),
})

const standards = [
  {
    code: "GB 50026",
    title: "工程测量标准",
    keywords: ["工程测量", "水准", "控制测量", "闭合差", "复测"],
    guidance: "用于工程控制测量、施工测量和变形监测成果复核时引用。",
  },
  {
    code: "GB 50911",
    title: "城市轨道交通工程监测技术规范",
    keywords: ["轨道交通", "监测", "沉降", "水平位移", "预警"],
    guidance: "用于地铁保护区、基坑和运营期监测方案、频率、报警处置说明。",
  },
  {
    code: "CJJ/T 8",
    title: "城市测量规范",
    keywords: ["城市测量", "控制网", "地形", "管线"],
    guidance: "用于市政测绘、城市控制网和地形图成果说明。",
  },
  {
    code: "CH/T 1004",
    title: "测绘技术设计规定",
    keywords: ["技术设计", "方案", "质量控制", "成果"],
    guidance: "用于测绘技术设计书、实施方案和质量保证章节。",
  },
  {
    code: "CH/T 1001",
    title: "测绘技术总结编写规定",
    keywords: ["技术总结", "报告", "成果", "质量"],
    guidance: "用于成果报告、技术总结和交付说明的结构复核。",
  },
]

const material = [
  { key: "control", label: "控制点成果", words: ["控制点", "cp", "cpiii", "导线", "control"] },
  { key: "observation", label: "外业观测记录", words: ["观测", "记录", "raw", "dat", "原始"] },
  { key: "adjustment", label: "平差计算成果", words: ["平差", "adjust", "闭合差", "成果表"] },
  { key: "report", label: "复测报告", words: ["报告", "总结", "复测"] },
  { key: "drawing", label: "成果图件", words: ["图", "dxf", "dwg", "cad"] },
  { key: "handover", label: "交接与签认资料", words: ["交接", "签认", "审批", "移交"] },
]

type FileInfo = {
  path: string
  name: string
  ext: string
  size: number
}

async function resolve(input?: string) {
  const target = input ? (path.isAbsolute(input) ? input : path.resolve(Instance.directory, input)) : Instance.directory
  const stat = Filesystem.stat(target)
  if (!stat) throw new Error(`Path not found: ${target}`)
  return { target, stat }
}

async function askRead(ctx: Tool.Context, target: string, kind: "file" | "directory") {
  await assertExternalDirectory(ctx, target, { kind })
  await ctx.ask({
    permission: "read",
    patterns: [kind === "directory" ? path.join(target, "*") : target],
    always: ["*"],
    metadata: {},
  })
}

async function scan(dir: string, limit = 300): Promise<FileInfo[]> {
  const result: FileInfo[] = []
  async function walk(current: string) {
    if (result.length >= limit) return
    const entries = await fs.readdir(current, { withFileTypes: true }).catch(() => [])
    await Promise.all(
      entries.map(async (entry) => {
        if (result.length >= limit) return
        const full = path.join(current, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === "node_modules" || entry.name === ".git") return
          await walk(full)
          return
        }
        const stat = Filesystem.stat(full)
        if (!stat) return
        result.push({
          path: full,
          name: entry.name,
          ext: path.extname(entry.name).toLowerCase(),
          size: Number(stat.size),
        })
      }),
    )
  }
  await walk(dir)
  return result
}

function rel(file: string) {
  return path.relative(Instance.worktree, file) || path.basename(file)
}

function rows(text: string) {
  return text
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/,|\t|;/).map((cell) => cell.trim()))
}

function numbers(row: string[]) {
  return row.map((cell) => Number(cell.replace(/mm|毫米|,|\s/g, ""))).filter((value) => Number.isFinite(value))
}

export const StandardQueryTool = Tool.define("standard_query_query_standard", {
  description: "检索 RAILWISE 内置工程测绘与轨道交通监测常用规范索引，返回可引用的规范方向和适用场景。",
  parameters: z.object({
    query: z.string().describe("Keyword or work scenario, for example: 水准闭合差、轨道交通监测、复测报告。"),
    limit: z.coerce.number().min(1).max(5).optional(),
  }),
  async execute(params) {
    const query = params.query.toLowerCase()
    const matches = standards
      .map((item) => ({
        item,
        score: item.keywords.filter((word) => query.includes(word.toLowerCase()) || word.toLowerCase().includes(query))
          .length,
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.item)
      .slice(0, params.limit ?? 3)
    const list = matches.length > 0 ? matches : standards.slice(0, params.limit ?? 3)

    return {
      title: "规范条文查询",
      output: [
        `查询：${params.query}`,
        ...list.map((item, index) => `${index + 1}. ${item.code}《${item.title}》：${item.guidance}`),
        "提示：Beta 内置规范索引用于确定引用方向，正式成果仍需以企业规范库或原文复核为准。",
      ].join("\n"),
      metadata: { matches: list.map((item) => item.code), query: params.query },
    }
  },
})

export const FileReaderTool = Tool.define("file_reader", {
  description: "读取或预览当前工作区内的文件和目录，适合工程资料首轮摸底。",
  parameters: read.extend({
    limit: z.coerce.number().min(1).max(100).default(30).describe("Maximum number of directory entries or text lines."),
  }),
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    await askRead(ctx, target, stat.isDirectory() ? "directory" : "file")
    if (stat.isDirectory()) {
      const files = await scan(target, params.limit)
      return {
        title: "本地文件读取",
        output: [`目录：${rel(target)}`, `文件：${files.length} 个`, ...files.map((file) => `${rel(file.path)} (${file.ext || "no ext"})`)].join("\n"),
        metadata: { type: "directory", count: files.length } as Record<string, unknown>,
      }
    }

    const mime = Filesystem.mimeType(target)
    const text = mime.startsWith("text/") || [".csv", ".txt", ".md", ".json", ".dxf"].includes(path.extname(target).toLowerCase())
    const output = text
      ? (await Filesystem.readText(target)).split(/\r?\n/).slice(0, params.limit).join("\n")
      : `Binary file: ${mime}, ${(Number(stat.size) / 1024).toFixed(1)} KB`
    return {
      title: "本地文件读取",
      output: [`文件：${rel(target)}`, output].join("\n"),
      metadata: { type: "file", mime, size: Number(stat.size) } as Record<string, unknown>,
    }
  },
})

export const LevelingClosureTool = Tool.define("survey_calculator_leveling_closure", {
  description: "快速检核水准路线闭合差。可直接输入 closure_mm，或输入 forward/backward 观测差值数组。",
  parameters: z.object({
    closure_mm: z.coerce.number().optional().describe("Observed closure error in millimeters."),
    forward: z.array(z.coerce.number()).optional().describe("Forward height differences in millimeters."),
    backward: z.array(z.coerce.number()).optional().describe("Backward height differences in millimeters."),
    route_km: z.coerce.number().positive().optional().describe("Route length in kilometers."),
    station_count: z.coerce.number().int().positive().optional().describe("Number of stations."),
    tolerance_mm: z.coerce.number().positive().optional().describe("Explicit tolerance in millimeters."),
  }),
  async execute(params) {
    const closure =
      params.closure_mm ??
      (params.forward && params.backward
        ? params.forward.reduce((sum, item) => sum + item, 0) - params.backward.reduce((sum, item) => sum + item, 0)
        : undefined)
    if (closure === undefined) throw new Error("Provide closure_mm or both forward and backward arrays.")

    const tolerance =
      params.tolerance_mm ??
      (params.route_km ? 12 * Math.sqrt(params.route_km) : params.station_count ? 4 * Math.sqrt(params.station_count) : 10)
    const ok = Math.abs(closure) <= tolerance

    return {
      title: "水准闭合差检核",
      output: [
        `闭合差：${closure.toFixed(2)} mm`,
        `限差：±${tolerance.toFixed(2)} mm`,
        `结论：${ok ? "闭合差满足限差。" : "闭合差超限，需复核观测记录、点号对应关系和计算表。"}`,
      ].join("\n"),
      metadata: { closure_mm: closure, tolerance_mm: tolerance, pass: ok },
    }
  },
})

export const ResurveyMaterialCheckTool = Tool.define("resurvey_material_check", {
  description: "扫描工作区复测资料，按控制点、观测记录、平差成果、报告、图件和签认资料列出完整性。",
  parameters: read.extend({
    required: z.array(z.enum(["control", "observation", "adjustment", "report", "drawing", "handover"])).optional(),
  }),
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const dir = stat.isDirectory() ? target : path.dirname(target)
    await askRead(ctx, dir, "directory")
    const files = await scan(dir)
    const required = new Set(params.required ?? material.map((item) => item.key))
    const status = material
      .filter((item) => required.has(item.key))
      .map((item) => ({
        item,
        files: files.filter((file) => item.words.some((word) => file.name.toLowerCase().includes(word.toLowerCase()))),
      }))

    const missing = status.filter((item) => item.files.length === 0)
    return {
      title: "复测资料检查",
      output: [
        `检查目录：${rel(dir)}`,
        `扫描文件：${files.length} 个`,
        ...status.map((item) =>
          item.files.length
            ? `✓ ${item.item.label}：${item.files.slice(0, 3).map((file) => rel(file.path)).join("，")}`
            : `! ${item.item.label}：未发现`,
        ),
        missing.length ? `下一步：补齐 ${missing.map((item) => item.item.label).join("、")}。` : "下一步：资料目录基本齐全，可进入技术复核。",
      ].join("\n"),
      metadata: { scanned: files.length, missing: missing.map((item) => item.item.key) },
    }
  },
})

export const MonitoringDataFirstCheckTool = Tool.define("monitoring_data_first_check", {
  description: "扫描 CSV/TXT 监测数据，统计数值列异常值并给出首检摘要。",
  parameters: read.extend({
    threshold_mm: z.coerce.number().positive().default(5).describe("Absolute value threshold in millimeters."),
  }),
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const threshold = params.threshold_mm ?? 5
    const dir = stat.isDirectory() ? target : path.dirname(target)
    await askRead(ctx, dir, "directory")
    const files = (stat.isDirectory() ? await scan(dir) : [{ path: target, name: path.basename(target), ext: path.extname(target), size: Number(stat.size) }]).filter(
      (file) => [".csv", ".txt", ".tsv"].includes(file.ext),
    )

    const summaries = await Promise.all(
      files.slice(0, 20).map(async (file) => {
        const table = rows(await Filesystem.readText(file.path).catch(() => ""))
        const body = table.slice(1)
        const values = body.flatMap(numbers)
        const alerts = values.filter((value) => Math.abs(value) >= threshold)
        return { file, rows: body.length, values: values.length, alerts }
      }),
    )
    const alerts = summaries.flatMap((item) => item.alerts.map((value) => ({ file: item.file, value })))

    return {
      title: "监测数据首检",
      output: [
        `阈值：±${threshold} mm`,
        `检查文件：${summaries.length} 个`,
        ...summaries.map((item) => `${rel(item.file.path)}：${item.rows} 行，${item.values} 个数值，${item.alerts.length} 个疑似异常`),
        alerts.length
          ? `需复核：${alerts.slice(0, 8).map((item) => `${rel(item.file.path)}=${item.value}`).join("，")}`
          : "未发现超过阈值的疑似异常值。",
      ].join("\n"),
      metadata: { files: summaries.length, alerts: alerts.length, threshold_mm: threshold },
    }
  },
})

export const DxfLayerInspectorTool = Tool.define("dxf_layer_inspector", {
  description: "读取 DXF 文本并提取图层，检查控制点、监测点、线路或构筑物等关键图层是否存在。",
  parameters: read.extend({
    required_layers: z.array(z.string()).optional().describe("Required layer keywords."),
  }),
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const files = stat.isDirectory() ? (await scan(target)).filter((file) => file.ext === ".dxf") : [{ path: target, name: path.basename(target), ext: path.extname(target), size: Number(stat.size) }]
    const file = files[0]
    if (!file) throw new Error("No DXF file found in the selected path.")
    await askRead(ctx, file.path, "file")
    const text = (await Filesystem.readText(file.path)).slice(0, 800_000)
    const lines = text.split(/\r?\n/).map((line) => line.trim())
    const layers = Array.from(
      new Set(
        lines
          .flatMap((line, index) => (line === "8" || line === "2" ? [lines[index + 1]] : []))
          .filter((line): line is string => Boolean(line && !["0", "LAYER", "TABLE", "ENDTAB"].includes(line))),
      ),
    ).slice(0, 60)
    const required = params.required_layers ?? ["CONTROL", "MONITOR", "LINE", "STRUCTURE"]
    const missing = required.filter((item) => !layers.some((layer) => layer.toLowerCase().includes(item.toLowerCase())))

    return {
      title: "DXF 图层检查",
      output: [
        `文件：${rel(file.path)}`,
        `识别图层：${layers.length ? layers.join("，") : "未识别到图层"}`,
        missing.length ? `缺少关键图层关键词：${missing.join("，")}` : "关键图层关键词基本齐全。",
      ].join("\n"),
      metadata: { file: file.path, layers, missing },
    }
  },
})

export const DocxReportFormatterTool = Tool.define("docx_report_formatter", {
  description: "检查 Word/Markdown 成果报告资料并给出排版、结构和交付清单建议。",
  parameters: read.extend({
    report_type: z.string().optional().describe("Report type, for example: 复测报告、监测月报、投标技术方案。"),
  }),
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const dir = stat.isDirectory() ? target : path.dirname(target)
    await askRead(ctx, dir, "directory")
    const files = (stat.isDirectory() ? await scan(dir) : [{ path: target, name: path.basename(target), ext: path.extname(target), size: Number(stat.size) }]).filter(
      (file) => [".doc", ".docx", ".md", ".txt"].includes(file.ext),
    )
    return {
      title: "Word 成果排版",
      output: [
        `报告类型：${params.report_type ?? "工程成果报告"}`,
        `候选文档：${files.length ? files.slice(0, 8).map((file) => rel(file.path)).join("，") : "未发现"}`,
        "排版清单：封面、目录、项目概况、依据规范、作业过程、质量检查、结论建议、附件目录。",
        "交付前检查：页眉页脚、图表编号、单位统一、签章页、电子版与纸质版文件名一致。",
      ].join("\n"),
      metadata: { documents: files.map((file) => file.path), report_type: params.report_type },
    }
  },
})

export const PptxBriefBuilderTool = Tool.define("pptx_brief_builder", {
  description: "生成工程项目汇报 PPT 的页序、标题和要点草案。",
  parameters: z.object({
    project_name: z.string().optional().describe("Project name."),
    phase: z.string().optional().describe("Project phase, for example: 前期踏勘、月度汇报、成果提交。"),
    audience: z.string().optional().describe("Audience, for example: 业主、专家组、公司内部。"),
    points: z.array(z.string()).optional().describe("Key points to include."),
  }),
  async execute(params) {
    const project = params.project_name ?? "当前项目"
    const phase = params.phase ?? "阶段汇报"
    const points = params.points?.length ? params.points : ["任务范围", "现场情况", "数据结论", "风险与下一步"]
    return {
      title: "PPT 汇报生成",
      output: [
        `${project} - ${phase}`,
        `对象：${params.audience ?? "项目相关方"}`,
        "1. 项目概况：范围、目标、时间节点",
        "2. 工作进展：已完成工作、投入人员设备",
        "3. 数据与成果：关键表格、图件和趋势",
        "4. 风险问题：异常点、缺失资料、需协调事项",
        "5. 下一步计划：责任人、时间、交付物",
        `重点：${points.join("；")}`,
      ].join("\n"),
      metadata: { project, phase, audience: params.audience, points },
    }
  },
})

export const PdfFormCheckerTool = Tool.define("pdf_form_checker", {
  description: "检查 PDF 交付资料的文件清单、大小和归档提示。",
  parameters: read,
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const files = stat.isDirectory()
      ? (await scan(target)).filter((file) => file.ext === ".pdf")
      : [{ path: target, name: path.basename(target), ext: path.extname(target), size: Number(stat.size) }]
    if (!files.length) throw new Error("No PDF file found in the selected path.")
    await askRead(ctx, stat.isDirectory() ? target : files[0].path, stat.isDirectory() ? "directory" : "file")
    return {
      title: "PDF 表单检查",
      output: [
        `PDF 文件：${files.length} 个`,
        ...files.slice(0, 12).map((file) => `${rel(file.path)}：${(file.size / 1024).toFixed(1)} KB`),
        "归档提示：检查签章页、报告编号、附件目录、文件名版本号和纸电一致性。",
      ].join("\n"),
      metadata: { files: files.map((file) => file.path) },
    }
  },
})

export const XlsxQualityCheckerTool = Tool.define("xlsx_quality_checker", {
  description: "检查 XLSX/CSV 表格的工作表、行列、空表头和明显空值，用于工程数据交付首检。",
  parameters: read,
  async execute(params, ctx) {
    const { target, stat } = await resolve(params.path)
    const files = stat.isDirectory()
      ? (await scan(target)).filter((file) => [".xlsx", ".xls", ".csv"].includes(file.ext))
      : [{ path: target, name: path.basename(target), ext: path.extname(target), size: Number(stat.size) }]
    const file = files[0]
    if (!file) throw new Error("No XLSX, XLS, or CSV file found in the selected path.")
    await askRead(ctx, file.path, "file")

    const workbook = XLSX.read(await Filesystem.readBytes(file.path), { type: "buffer", dense: true })
    const summaries = workbook.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(workbook.Sheets[name], { header: 1, defval: null })
      const width = Math.max(0, ...rows.map((row) => row.length))
      const header = rows[0] ?? []
      const emptyHeaders = Array.from({ length: width }).filter((_, index) => !String(header[index] ?? "").trim()).length
      const emptyCells = rows.flatMap((row) => row).filter((cell) => cell === null || String(cell).trim() === "").length
      return { name, rows: Math.max(rows.length - 1, 0), columns: width, emptyHeaders, emptyCells }
    })

    return {
      title: "Excel 表格校验",
      output: [
        `文件：${rel(file.path)}`,
        ...summaries.map(
          (item) =>
            `${item.name}：${item.rows} 行，${item.columns} 列，空表头 ${item.emptyHeaders} 个，空值 ${item.emptyCells} 个`,
        ),
        summaries.some((item) => item.emptyHeaders > 0)
          ? "下一步：先补齐空表头，再进行统计或报告生成。"
          : "表头结构可用，可进入数据统计或报告生成。",
      ].join("\n"),
      metadata: { file: file.path, sheets: summaries },
    }
  },
})
