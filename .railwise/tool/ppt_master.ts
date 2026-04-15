/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"
import path from "path"
import { existsSync, readFileSync, statSync } from "node:fs"

const PPT_MASTER_DIR = path.join(process.env.HOME || "~", "CODE", "ppt-master")
const PROJECTS_DIR = path.join(PPT_MASTER_DIR, "projects")
const PLATFORM_BASE = process.env.RAILWISE_PLATFORM_URL || "http://localhost:3001"

function python(script: string, args: string[], cwd?: string) {
  return new Promise<{ stdout: string; stderr: string; exitCode: number }>(
    (resolve) => {
      const proc = Bun.spawn(["python3", path.join(PPT_MASTER_DIR, "tools", script), ...args], {
        cwd: cwd || PPT_MASTER_DIR,
        stdout: "pipe",
        stderr: "pipe",
      })

      Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]).then(([stdout, stderr, exitCode]) =>
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), exitCode })
      )
    }
  )
}

async function registerPptx(pptxPath: string, title: string) {
  const stat = statSync(pptxPath)
  const fileData = readFileSync(pptxPath)
  const fileName = path.basename(pptxPath)
  const mime = "application/vnd.openxmlformats-officedocument.presentationml.presentation"

  const form = new FormData()
  form.append("file", new Blob([fileData], { type: mime }), fileName)
  form.append("ownerUserId", "user-admin")
  form.append("title", title)
  form.append("category", "other")
  form.append("description", `PPT Master 自动导出: ${fileName}`)

  const resp = await fetch(`${PLATFORM_BASE}/api/v1/files/temp/finalize`, {
    method: "POST",
    body: form,
  })

  if (!resp.ok) return null
  const result = await resp.json() as { code: number; data: { fileId: string } }
  if (result.code !== 200) return null
  return { fileId: result.data.fileId, sizeKb: +(stat.size / 1024).toFixed(1) }
}

// ── Tool 1: ppt_project_init ──────────────────────────────

export const ppt_project_init = tool({
  description:
    "初始化 PPT Master 项目文件夹。创建标准项目结构（svg_output/、svg_final/、images/、notes/、templates/）。" +
    "ppt_designer 在开始新 PPT 任务时必须首先调用此工具。",
  args: {
    projectName: tool.schema
      .string()
      .describe("项目名称，如：宁波轨道交通运营监测评估报告"),
    format: tool.schema
      .enum(["ppt169", "ppt43", "xhs", "story", "moments", "gzh_header"])
      .default("ppt169")
      .describe(
        "画布格式：ppt169=PPT 16:9(默认), ppt43=PPT 4:3, xhs=小红书, story=Story竖版, moments=朋友圈, gzh_header=公众号头图"
      ),
  },
  async execute(args) {
    if (!existsSync(path.join(PPT_MASTER_DIR, "tools", "project_manager.py")))
      return JSON.stringify({
        error: `PPT Master 未安装，请确认 ${PPT_MASTER_DIR} 目录存在`,
      })

    const result = await python("project_manager.py", [
      "init",
      args.projectName,
      "--format",
      args.format,
    ])

    if (result.exitCode !== 0)
      return JSON.stringify({
        error: `项目初始化失败: ${result.stderr || result.stdout}`,
      })

    const projectPath = path.join(PROJECTS_DIR, `${args.projectName}_${args.format}_${new Date().toISOString().slice(0, 10).replace(/-/g, "")}`)

    return JSON.stringify({
      success: true,
      projectPath,
      format: args.format,
      output: result.stdout,
      message: `✅ 项目已创建。路径: ${projectPath}`,
      nextStep: "请完成八项确认后，开始生成 SVG 页面到 svg_output/ 目录",
    })
  },
})

// ── Tool 2: ppt_source_convert ────────────────────────────

export const ppt_source_convert = tool({
  description:
    "将 PDF 文件或网页 URL 转换为 Markdown 格式，作为 PPT 内容的源文档。" +
    "ppt_designer 在用户提供 PDF 或 URL 时必须调用此工具。",
  args: {
    source: tool.schema
      .string()
      .describe("PDF 文件的绝对路径 或 网页 URL"),
    sourceType: tool.schema
      .enum(["pdf", "url", "wechat"])
      .describe(
        "源内容类型：pdf=PDF文件, url=普通网页, wechat=微信公众号/高防站点"
      ),
  },
  async execute(args) {
    if (args.sourceType === "pdf") {
      if (!existsSync(args.source))
        return JSON.stringify({ error: `PDF 文件不存在: ${args.source}` })

      const result = await python("pdf_to_md.py", [args.source])

      if (result.exitCode !== 0)
        return JSON.stringify({
          error: `PDF 转换失败: ${result.stderr || result.stdout}`,
        })

      return JSON.stringify({
        success: true,
        output: result.stdout,
        message: "✅ PDF 已转换为 Markdown",
      })
    }

    if (args.sourceType === "wechat") {
      const proc = Bun.spawn(
        ["node", path.join(PPT_MASTER_DIR, "tools", "web_to_md.cjs"), args.source],
        { cwd: PPT_MASTER_DIR, stdout: "pipe", stderr: "pipe" }
      )
      const [stdout, stderr, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])

      if (exitCode !== 0)
        return JSON.stringify({ error: `网页转换失败: ${stderr || stdout}` })

      return JSON.stringify({
        success: true,
        output: stdout.trim(),
        message: "✅ 微信公众号页面已转换为 Markdown",
      })
    }

    const result = await python("web_to_md.py", [args.source])

    if (result.exitCode !== 0)
      return JSON.stringify({
        error: `网页转换失败: ${result.stderr || result.stdout}`,
      })

    return JSON.stringify({
      success: true,
      output: result.stdout,
      message: "✅ 网页已转换为 Markdown",
    })
  },
})

// ── Tool 3: ppt_finalize ──────────────────────────────────

export const ppt_finalize = tool({
  description:
    "对 PPT 项目执行后处理：拆分演讲备注 + SVG后处理（嵌入图标、智能裁剪图片、修复宽高比、嵌入图片Base64、文本扁平化、圆角矩形转Path）。" +
    "ppt_designer 在所有 SVG 页面和演讲备注生成完毕后，必须调用此工具。",
  args: {
    projectPath: tool.schema
      .string()
      .describe("PPT 项目的绝对路径（包含 svg_output/ 目录的那个文件夹）"),
  },
  async execute(args) {
    if (!existsSync(args.projectPath))
      return JSON.stringify({ error: `项目路径不存在: ${args.projectPath}` })

    if (!existsSync(path.join(args.projectPath, "svg_output")))
      return JSON.stringify({
        error: `svg_output/ 目录不存在，请先生成 SVG 页面`,
      })

    const notesFile = path.join(args.projectPath, "notes", "total.md")
    if (existsSync(notesFile)) {
      const split = await python("total_md_split.py", [args.projectPath])
      if (split.exitCode !== 0)
        return JSON.stringify({
          error: `演讲备注拆分失败: ${split.stderr || split.stdout}`,
        })
    }

    const finalize = await python("finalize_svg.py", [args.projectPath])

    if (finalize.exitCode !== 0)
      return JSON.stringify({
        error: `SVG 后处理失败: ${finalize.stderr || finalize.stdout}`,
      })

    return JSON.stringify({
      success: true,
      output: finalize.stdout,
      message: "✅ 后处理完成：图标嵌入、图片处理、文本扁平化已执行。SVG 文件已输出到 svg_final/",
      nextStep: "请调用 ppt_export 工具导出 PPTX",
    })
  },
})

// ── Tool 4: ppt_export ────────────────────────────────────

export const ppt_export = tool({
  description:
    "将后处理完成的 SVG 文件导出为 PowerPoint (.pptx) 文件，自动嵌入演讲备注。" +
    "ppt_designer 在 ppt_finalize 成功后调用此工具完成最终交付。",
  args: {
    projectPath: tool.schema
      .string()
      .describe("PPT 项目的绝对路径"),
    noNotes: tool.schema
      .boolean()
      .default(false)
      .optional()
      .describe("是否不嵌入演讲备注（默认嵌入）"),
  },
  async execute(args) {
    if (!existsSync(args.projectPath))
      return JSON.stringify({ error: `项目路径不存在: ${args.projectPath}` })

    const svgFinal = path.join(args.projectPath, "svg_final")
    if (!existsSync(svgFinal))
      return JSON.stringify({
        error: `svg_final/ 目录不存在，请先调用 ppt_finalize 进行后处理`,
      })

    const exportArgs = [args.projectPath, "-s", "final"]
    if (args.noNotes) exportArgs.push("--no-notes")

    const result = await python("svg_to_pptx.py", exportArgs)

    if (result.exitCode !== 0)
      return JSON.stringify({
        error: `PPTX 导出失败: ${result.stderr || result.stdout}`,
      })

    const pptxFiles = (await Array.fromAsync(new Bun.Glob("*.pptx").scan(args.projectPath)))
    const latest = pptxFiles.sort().pop()
    const pptxPath = latest ? path.join(args.projectPath, latest) : ""

    let registered = null
    if (pptxPath && existsSync(pptxPath)) {
      const pptxTitle = path.basename(pptxPath, ".pptx")
      registered = await registerPptx(pptxPath, pptxTitle).catch(() => null)
    }

    return JSON.stringify({
      success: true,
      pptxPath: pptxPath || "查看项目目录中的 .pptx 文件",
      output: result.stdout,
      fileId: registered?.fileId || null,
      message: registered
        ? `✅ PPTX 已导出并注册到平台（${registered.sizeKb} KB），可在「文件管理」页面查看和下载。`
        : `✅ PPTX 已导出${args.noNotes ? "（无演讲备注）" : "（含演讲备注）"}`,
    })
  },
})
