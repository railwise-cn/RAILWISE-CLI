import path from "path"
import * as fs from "fs/promises"
import * as XLSX from "xlsx"
import { BlobReader, TextWriter, ZipReader, type Entry } from "@zip.js/zip.js"
import z from "zod"
import { Instance } from "../project/instance"
import { Glob } from "../util/glob"
import { Filesystem } from "../util/filesystem"
import { Tool } from "./tool"
import { assertExternalDirectory } from "./external-directory"

const OUTPUT_DIR = "output"
const TEXT_LIMIT = 20_000

function resolve(input: string) {
  if (path.isAbsolute(input)) return input
  return path.resolve(Instance.directory, input)
}

function title(filepath: string) {
  return path.relative(Instance.worktree, filepath) || path.basename(filepath)
}

async function readText(filepath: string, ctx: Tool.Context) {
  await assertExternalDirectory(ctx, filepath)
  await ctx.ask({
    permission: "read",
    patterns: [filepath],
    always: ["*"],
    metadata: {},
  })
  return Bun.file(filepath).text()
}

async function writeOutput(outputDir: string | undefined, filename: string, content: string, ctx: Tool.Context) {
  const dir = resolve(outputDir ?? OUTPUT_DIR)
  const filepath = path.join(dir, filename)
  await assertExternalDirectory(ctx, dir, { kind: "directory" })
  await ctx.ask({
    permission: "write",
    patterns: [filepath],
    always: [path.join(dir, "*")],
    metadata: {},
  })
  await fs.mkdir(dir, { recursive: true })
  await Bun.write(filepath, content)
  return filepath
}

function xml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

async function zipEntries(filepath: string) {
  const reader = new ZipReader(new BlobReader(new Blob([await Bun.file(filepath).arrayBuffer()])))
  const entries = await reader.getEntries()
  return { reader, entries }
}

async function zipTexts(filepath: string, match: (entry: Entry) => boolean) {
  const zip = await zipEntries(filepath)
  const values = await Promise.all(
    zip.entries
      .filter(match)
      .sort((a, b) => a.filename.localeCompare(b.filename, undefined, { numeric: true }))
      .map((entry) => entry.getData?.(new TextWriter()).then((text) => xml(text)) ?? ""),
  )
  await zip.reader.close()
  return values.filter(Boolean).join("\n\n")
}

function csvRows(text: string) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const headers = (lines[0] ?? "").split(/,|\t/).map((item) => item.trim())
  return lines
    .slice(1)
    .map((line) =>
      Object.fromEntries(
        line.split(/,|\t/).map((value, index) => [headers[index] ?? `column_${index + 1}`, value.trim()]),
      ),
    )
}

function workbookRows(filepath: string, sheet?: string) {
  const book = XLSX.readFile(filepath, { cellDates: true })
  const name = sheet ?? book.SheetNames[0]
  if (!name) return []
  const data = book.Sheets[name]
  if (!data) throw new Error(`Sheet not found: ${name}`)
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(data, { defval: "" })
}

async function tableRows(filepath: string, sheet?: string) {
  const ext = path.extname(filepath).toLowerCase()
  if (ext === ".xlsx" || ext === ".xls") return workbookRows(filepath, sheet)
  return csvRows(await Bun.file(filepath).text())
}

function tableSummary(rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {})
  return [
    `rows: ${rows.length}`,
    `columns: ${headers.length}`,
    headers.length ? `headers: ${headers.join(", ")}` : "headers: none",
    rows.length ? `sample: ${JSON.stringify(rows.slice(0, 3))}` : "sample: []",
  ].join("\n")
}

function dxfLayers(text: string) {
  const lines = text.split(/\r?\n/).map((line) => line.trim())
  const counts = new Map<string, number>()
  lines.forEach((line, index) => {
    if (line !== "8") return
    const layer = lines[index + 1]
    if (!layer) return
    counts.set(layer, (counts.get(layer) ?? 0) + 1)
  })
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
}

function safeFilename(value: string) {
  const name = value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "-")
  return name || `railwise-${Date.now()}`
}

export const FileReaderTool = Tool.define("file_reader", {
  description: "识读常用办公文档、工程图纸和文本成果，返回适合智能体继续处理的结构化摘要。",
  parameters: z.object({
    filePath: z.string().describe("文件路径，支持 txt/csv/json/md/dxf/docx/pptx/xlsx/pdf"),
    sheet: z.string().optional().describe("Excel 工作表名称"),
  }),
  async execute(params, ctx) {
    const filepath = resolve(params.filePath)
    const ext = path.extname(filepath).toLowerCase()
    await assertExternalDirectory(ctx, filepath)
    await ctx.ask({ permission: "read", patterns: [filepath], always: ["*"], metadata: {} })

    const output = await (async () => {
      if (ext === ".docx") return await zipTexts(filepath, (entry) => entry.filename === "word/document.xml")
      if (ext === ".pptx")
        return await zipTexts(filepath, (entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.filename))
      if (ext === ".xlsx" || ext === ".xls") return tableSummary(workbookRows(filepath, params.sheet))
      if (ext === ".dxf") {
        const layers = dxfLayers(await Bun.file(filepath).text())
        return [`layers: ${layers.length}`, ...layers.map(([layer, count]) => `${layer}: ${count}`)].join("\n")
      }
      if (ext === ".pdf") {
        const bytes = await Bun.file(filepath).arrayBuffer()
        return [
          `type: pdf`,
          `bytes: ${bytes.byteLength}`,
          "content: use pdf_form_checker or MinerU parsing for details",
        ].join("\n")
      }
      return (await Bun.file(filepath).text()).slice(0, TEXT_LIMIT)
    })()

    return {
      title: title(filepath),
      output,
      metadata: {
        preview: output.slice(0, 2_000),
        extension: ext,
      },
    }
  },
})

export const StandardQueryTool = Tool.define("standard_query_query_standard", {
  description: "在本地 wiki/knowledge/docs 目录中检索规范、标准、作业指导书和项目知识库条目。",
  parameters: z.object({
    query: z.string().describe("检索关键词"),
    root: z.string().optional().describe("知识库根目录，默认依次扫描 wiki、knowledge、docs"),
    limit: z.number().optional().default(8).describe("最多返回条数"),
  }),
  async execute(params, ctx) {
    const roots = params.root ? [params.root] : ["wiki", "knowledge", "docs"]
    const files = roots.flatMap((root) => {
      const dir = resolve(root)
      if (!Filesystem.exists(dir)) return []
      return Glob.scanSync("**/*.{md,txt}", { cwd: dir, absolute: true, dot: true, symlink: false })
    })
    const query = params.query.toLowerCase()
    const matches = (
      await Promise.all(
        files.map(async (filepath) => {
          await assertExternalDirectory(ctx, filepath)
          const text = await Bun.file(filepath).text()
          const index = text.toLowerCase().indexOf(query)
          if (index < 0) return
          return {
            filepath,
            excerpt: text.slice(Math.max(0, index - 120), index + params.query.length + 240).replace(/\s+/g, " "),
          }
        }),
      )
    ).filter((item): item is { filepath: string; excerpt: string } => Boolean(item))

    const output = matches
      .slice(0, params.limit)
      .map((item, index) => `${index + 1}. ${path.relative(Instance.directory, item.filepath)}\n${item.excerpt}`)
      .join("\n\n")

    return {
      title: `standard query: ${params.query}`,
      output: output || "No local standard/wiki matches found.",
      metadata: { matches: matches.length },
    }
  },
})

export const LevelingClosureTool = Tool.define("survey_calculator_leveling_closure", {
  description: "计算水准路线闭合差，并按给定限差或每公里经验限差给出是否超限。",
  parameters: z.object({
    elevationDifferences: z.array(z.number()).optional().describe("各测段高差，单位 m"),
    filePath: z.string().optional().describe("包含高差数字的文本/CSV 文件"),
    distanceKm: z.number().optional().describe("路线长度，单位 km"),
    toleranceMm: z.number().optional().describe("闭合差限差，单位 mm"),
  }),
  async execute(params, ctx) {
    const values =
      params.elevationDifferences ??
      (params.filePath
        ? ((await readText(resolve(params.filePath), ctx))
            .match(/[-+]?\d+(?:\.\d+)?/g)
            ?.map((value) => Number(value)) ?? [])
        : [])
    const closure = values.reduce((sum, value) => sum + value, 0)
    const tolerance = params.toleranceMm ?? (params.distanceKm ? 4 * Math.sqrt(params.distanceKm) : undefined)
    const closureMm = closure * 1_000
    const ok = tolerance === undefined ? undefined : Math.abs(closureMm) <= tolerance

    return {
      title: "leveling closure",
      output: [
        `segments: ${values.length}`,
        `closure_m: ${closure.toFixed(6)}`,
        `closure_mm: ${closureMm.toFixed(2)}`,
        tolerance === undefined ? "tolerance_mm: not provided" : `tolerance_mm: ${tolerance.toFixed(2)}`,
        ok === undefined ? "status: unchecked" : `status: ${ok ? "pass" : "fail"}`,
      ].join("\n"),
      metadata: { closure, closureMm, tolerance, ok },
    }
  },
})

export const ResurveyMaterialCheckTool = Tool.define("resurvey_material_check", {
  description: "检查复测资料包是否包含常见必备材料，并输出缺项清单。",
  parameters: z.object({
    directory: z.string().describe("复测资料目录"),
  }),
  async execute(params, ctx) {
    const dir = resolve(params.directory)
    await assertExternalDirectory(ctx, dir, { kind: "directory" })
    await ctx.ask({ permission: "read", patterns: [path.join(dir, "*")], always: ["*"], metadata: {} })
    const files = Glob.scanSync("**/*", { cwd: dir, absolute: false, dot: false, symlink: false })
    const checks = [
      ["control", /控制|control|cp/i],
      ["observation", /观测|测量|raw|dat|csv|in2/i],
      ["adjustment", /平差|adjust|report/i],
      ["result", /成果|result|坐标|高程/i],
    ] as const
    const rows = checks.map(([name, pattern]) => ({ name, ok: files.some((file) => pattern.test(file)) }))

    return {
      title: "resurvey material check",
      output: rows.map((row) => `${row.ok ? "[x]" : "[ ]"} ${row.name}`).join("\n"),
      metadata: { total: files.length, missing: rows.filter((row) => !row.ok).map((row) => row.name) },
    }
  },
})

export const MonitoringDataFirstCheckTool = Tool.define("monitoring_data_first_check", {
  description: "对监测首检数据做空值、重复点号、非数值字段和基础统计检查。",
  parameters: z.object({
    filePath: z.string().describe("CSV/XLS/XLSX 监测数据表"),
    sheet: z.string().optional().describe("Excel 工作表名称"),
    pointColumn: z.string().optional().describe("点号列名"),
    valueColumns: z.array(z.string()).optional().describe("需检查为数值的列名"),
  }),
  async execute(params, ctx) {
    const filepath = resolve(params.filePath)
    await assertExternalDirectory(ctx, filepath)
    await ctx.ask({ permission: "read", patterns: [filepath], always: ["*"], metadata: {} })
    const rows = await tableRows(filepath, params.sheet)
    const headers = Object.keys(rows[0] ?? {})
    const point = params.pointColumn ?? headers.find((header) => /点|point|id|编号/i.test(header))
    const values = params.valueColumns ?? headers.filter((header) => header !== point)
    const duplicates = point
      ? Array.from(
          rows
            .map((row) => String(row[point] ?? "").trim())
            .filter(Boolean)
            .reduce((map, name) => map.set(name, (map.get(name) ?? 0) + 1), new Map<string, number>()),
        ).filter(([, count]) => count > 1)
      : []
    const blank = rows.filter((row) => Object.values(row).some((value) => String(value ?? "").trim() === "")).length
    const nonNumeric = values.flatMap((column) =>
      rows
        .map((row, index) => ({ row: index + 2, column, value: row[column] }))
        .filter((item) => String(item.value ?? "").trim() !== "" && !Number.isFinite(Number(item.value))),
    )

    return {
      title: "monitoring data first check",
      output: [
        tableSummary(rows),
        `point_column: ${point ?? "not detected"}`,
        `blank_rows: ${blank}`,
        `duplicate_points: ${duplicates.length}`,
        `non_numeric_cells: ${nonNumeric.length}`,
      ].join("\n"),
      metadata: { rows: rows.length, columns: headers.length, duplicates, blank, nonNumeric: nonNumeric.slice(0, 50) },
    }
  },
})

export const DxfLayerInspectorTool = Tool.define("dxf_layer_inspector", {
  description: "识读 DXF 图纸图层使用情况，帮助工程图纸快速摸底。",
  parameters: z.object({
    filePath: z.string().describe("DXF 文件路径"),
  }),
  async execute(params, ctx) {
    const filepath = resolve(params.filePath)
    const layers = dxfLayers(await readText(filepath, ctx))
    const output = layers.map(([layer, count]) => `${layer}: ${count}`).join("\n")
    return {
      title: title(filepath),
      output: output || "No DXF layers found.",
      metadata: { layers: layers.length },
    }
  },
})

export const XlsxQualityCheckerTool = Tool.define("xlsx_quality_checker", {
  description: "检查 Excel 工作簿的工作表、表头、空列和基础行列规模。",
  parameters: z.object({
    filePath: z.string().describe("XLS/XLSX 文件路径"),
  }),
  async execute(params, ctx) {
    const filepath = resolve(params.filePath)
    await assertExternalDirectory(ctx, filepath)
    await ctx.ask({ permission: "read", patterns: [filepath], always: ["*"], metadata: {} })
    const book = XLSX.readFile(filepath, { cellDates: true })
    const sheets = book.SheetNames.map((name) => {
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(book.Sheets[name]!, { defval: "" })
      const headers = Object.keys(rows[0] ?? {})
      return { name, rows: rows.length, columns: headers.length, headers }
    })

    return {
      title: title(filepath),
      output: sheets.map((sheet) => `${sheet.name}: ${sheet.rows} rows, ${sheet.columns} columns`).join("\n"),
      metadata: { sheets },
    }
  },
})

export const DocxReportFormatterTool = Tool.define("docx_report_formatter", {
  description: "把工程报告内容整理成 Word 转换友好的 Markdown，并固定输出到 output 目录。",
  parameters: z.object({
    title: z.string().describe("报告标题"),
    markdown: z.string().optional().describe("报告 Markdown 内容"),
    sourcePath: z.string().optional().describe("已有 Markdown/文本文件路径"),
    outputDir: z.string().optional().describe("输出目录，默认 output"),
  }),
  async execute(params, ctx) {
    const body = params.markdown ?? (params.sourcePath ? await readText(resolve(params.sourcePath), ctx) : "")
    if (!body.trim()) throw new Error("Provide markdown or sourcePath")
    const content = [`# ${params.title}`, "", body.trim(), "", "> RAILWISE: Word-ready Markdown"].join("\n")
    const filepath = await writeOutput(params.outputDir, `${safeFilename(params.title)}.md`, content, ctx)
    return {
      title: path.relative(Instance.directory, filepath),
      output: `Word-ready Markdown written to ${filepath}`,
      metadata: { outputPath: filepath },
    }
  },
})

export const PptxBriefBuilderTool = Tool.define("pptx_brief_builder", {
  description: "生成工程汇报 PPT 大纲 Markdown，固定写入 output 目录，便于后续转 PPTX。",
  parameters: z.object({
    title: z.string().describe("汇报标题"),
    sections: z.array(z.object({ title: z.string(), bullets: z.array(z.string()) })).describe("汇报章节"),
    outputDir: z.string().optional().describe("输出目录，默认 output"),
  }),
  async execute(params, ctx) {
    const content = [
      `# ${params.title}`,
      "",
      ...params.sections.flatMap((section) => [
        "---",
        "",
        `## ${section.title}`,
        "",
        ...section.bullets.map((bullet) => `- ${bullet}`),
        "",
      ]),
    ].join("\n")
    const filepath = await writeOutput(params.outputDir, `${safeFilename(params.title)}-brief.md`, content, ctx)
    return {
      title: path.relative(Instance.directory, filepath),
      output: `PPT brief Markdown written to ${filepath}`,
      metadata: { outputPath: filepath, slides: params.sections.length },
    }
  },
})

export const PdfFormCheckerTool = Tool.define("pdf_form_checker", {
  description: "检查 PDF 是否包含 AcroForm 表单字段，并给出基础结构摘要。",
  parameters: z.object({
    filePath: z.string().describe("PDF 文件路径"),
  }),
  async execute(params, ctx) {
    const filepath = resolve(params.filePath)
    await assertExternalDirectory(ctx, filepath)
    await ctx.ask({ permission: "read", patterns: [filepath], always: ["*"], metadata: {} })
    const text = Buffer.from(await Bun.file(filepath).arrayBuffer()).toString("latin1")
    const fields = text.match(/\/T\s*\(([^)]*)\)/g) ?? []
    const hasForm = text.includes("/AcroForm")

    return {
      title: title(filepath),
      output: [`acroform: ${hasForm}`, `fields: ${fields.length}`, ...fields.slice(0, 20)].join("\n"),
      metadata: { hasForm, fields: fields.length },
    }
  },
})
