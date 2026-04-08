/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"
import path from "path"
import { existsSync, statSync, readFileSync } from "node:fs"

const PLATFORM_BASE = process.env.RAILWISE_PLATFORM_URL || "http://localhost:3001"

const MIME_MAP: Record<string, string> = {
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".pdf": "application/pdf",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".csv": "text/csv",
  ".json": "application/json",
  ".txt": "text/plain",
  ".md": "text/markdown",
}

function guessMime(ext: string) {
  return MIME_MAP[ext.toLowerCase()] || "application/octet-stream"
}

export default tool({
  description:
    "将 AI 生成的文件（报告、表格、图表等）注册到睿威智测平台的文件管理系统。" +
    "report_export、excel_export、chart_generator 等工具生成文件后，必须调用此工具将文件注册到平台，" +
    "使用户可在「文件管理」页面查看、下载和归档。",
  args: {
    filePath: tool.schema.string().describe("已生成文件的路径（绝对或相对路径）"),
    title: tool.schema.string().describe("文件显示名称"),
    category: tool.schema
      .enum(["report", "spreadsheet", "chart", "raw_data", "template", "other"])
      .describe("文件类型分类"),
    ownerUserId: tool.schema
      .string()
      .default("user-admin")
      .describe("文件所属用户 ID（默认为管理员）"),
    sessionId: tool.schema
      .string()
      .optional()
      .describe("关联的 AI 会话 ID"),
    projectId: tool.schema
      .string()
      .optional()
      .describe("关联的项目 ID（如提供则直接归档到项目）"),
    description: tool.schema
      .string()
      .default("")
      .describe("文件描述"),
  },
  async execute(args) {
    const resolved = path.resolve(args.filePath)

    if (!existsSync(resolved))
      return JSON.stringify({ success: false, error: `文件不存在: ${resolved}` })

    const stat = statSync(resolved)
    if (!stat.isFile())
      return JSON.stringify({ success: false, error: `路径不是文件: ${resolved}` })

    const ext = path.extname(resolved)
    const fileName = path.basename(resolved)
    const mime = guessMime(ext)
    const fileData = readFileSync(resolved)

    const form = new FormData()
    form.append("file", new Blob([fileData], { type: mime }), fileName)
    form.append("ownerUserId", args.ownerUserId)
    form.append("title", args.title)
    form.append("category", args.category)
    form.append("description", args.description)
    if (args.sessionId) form.append("sessionId", args.sessionId)
    if (args.projectId) form.append("projectId", args.projectId)

    const url = `${PLATFORM_BASE}/api/v1/files/temp/finalize`

    const resp = await fetch(url, { method: "POST", body: form })

    if (!resp.ok) {
      const text = await resp.text().catch(() => "")
      return JSON.stringify({
        success: false,
        error: `平台返回 ${resp.status}: ${text}`,
        hint: "确认 monitoring-server 正在运行（端口 3001）",
      })
    }

    const result = await resp.json() as { code: number; data: { fileId: string; versionId: string; storagePath: string }; message: string }

    if (result.code !== 200)
      return JSON.stringify({ success: false, error: result.message })

    const sizeKb = (stat.size / 1024).toFixed(1)

    return JSON.stringify({
      success: true,
      fileId: result.data.fileId,
      versionId: result.data.versionId,
      title: args.title,
      category: args.category,
      sizeKb: Number(sizeKb),
      message: `✅ 文件已注册到平台：「${args.title}」（${sizeKb} KB），可在「文件管理」页面查看和下载。`,
    })
  },
})
