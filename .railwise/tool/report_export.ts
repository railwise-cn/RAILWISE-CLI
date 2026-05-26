/// <reference path="../env.d.ts" />
import { tool, type ToolContext } from "nb-railwise/tool"
import { deflateRawSync } from "node:zlib"
import { mkdir } from "node:fs/promises"
import path from "path"

// ============================================================
// Minimal ZIP builder (DOCX = ZIP of XML files)
// ============================================================

function crc32(buf: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!
    for (let j = 0; j < 8; j++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0)
  }
  return (c ^ 0xffffffff) >>> 0
}

function zip(files: Array<{ name: string; data: Uint8Array }>) {
  const entries: Array<{
    name: Uint8Array
    compressed: Uint8Array
    crc: number
    size: number
    csize: number
    offset: number
  }> = []
  const parts: Uint8Array[] = []
  let offset = 0

  for (const f of files) {
    const nameBytes = new TextEncoder().encode(f.name)
    const crc = crc32(f.data)
    const compressed = new Uint8Array(deflateRawSync(f.data))
    const header = new Uint8Array(30 + nameBytes.length)
    const v = new DataView(header.buffer)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(8, 8, true)
    v.setUint32(14, crc, true)
    v.setUint32(18, compressed.length, true)
    v.setUint32(22, f.data.length, true)
    v.setUint16(26, nameBytes.length, true)
    header.set(nameBytes, 30)

    entries.push({ name: nameBytes, compressed, crc, size: f.data.length, csize: compressed.length, offset })
    parts.push(header, compressed)
    offset += header.length + compressed.length
  }

  const cdStart = offset
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.name.length)
    const v = new DataView(cd.buffer)
    v.setUint32(0, 0x02014b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(6, 20, true)
    v.setUint16(10, 8, true)
    v.setUint32(16, e.crc, true)
    v.setUint32(20, e.csize, true)
    v.setUint32(24, e.size, true)
    v.setUint16(28, e.name.length, true)
    v.setUint32(42, e.offset, true)
    cd.set(e.name, 46)
    parts.push(cd)
    offset += cd.length
  }

  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(8, entries.length, true)
  ev.setUint16(10, entries.length, true)
  ev.setUint32(12, offset - cdStart, true)
  ev.setUint32(16, cdStart, true)
  parts.push(eocd)

  let total = 0
  for (const p of parts) total += p.length
  const result = new Uint8Array(total)
  let pos = 0
  for (const p of parts) {
    result.set(p, pos)
    pos += p.length
  }
  return result
}

// ============================================================
// Markdown → DOCX XML conversion
// ============================================================

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
}

function safe(s: string) {
  return (
    s
      .replace(/[/\\:*?"<>|]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80) || "report"
  )
}

function root(context: ToolContext) {
  return context.worktree || context.directory || process.cwd()
}

function run(context: ToolContext) {
  return safe(context.sessionID || "manual")
}

function resolve(context: ToolContext, target: string) {
  return path.isAbsolute(target) ? target : path.join(root(context), target)
}

function dest(context: ToolContext, title: string, outputPath?: string) {
  if (outputPath) return resolve(context, outputPath)
  return path.join(root(context), "output", "runs", run(context), "reports", `${safe(title)}.docx`)
}

function draft(context: ToolContext, title: string, suffix: string) {
  return path.join(root(context), "output", "runs", run(context), "drafts", `${safe(title)}${suffix}`)
}

function md2paragraphs(markdown: string) {
  const lines = markdown.split("\n")
  const paragraphs: string[] = []

  for (const line of lines) {
    const trimmed = line.trimEnd()

    if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^(#{1,6})/)?.[1]?.length ?? 1
      const text = trimmed.replace(/^#{1,6}\s+/, "")
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="Heading${level}"/></w:pPr><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`,
      )
      continue
    }

    if (/^[-*]\s/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, "")
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`,
      )
      continue
    }

    if (/^\d+\.\s/.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s+/, "")
      paragraphs.push(
        `<w:p><w:pPr><w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="2"/></w:numPr></w:pPr><w:r><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`,
      )
      continue
    }

    if (/^>\s/.test(trimmed)) {
      const text = trimmed.replace(/^>\s*/, "")
      paragraphs.push(
        `<w:p><w:pPr><w:ind w:left="720"/></w:pPr><w:r><w:rPr><w:i/></w:rPr><w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`,
      )
      continue
    }

    if (/^---$/.test(trimmed) || /^\*\*\*$/.test(trimmed)) {
      paragraphs.push(
        `<w:p><w:pPr><w:pBdr><w:bottom w:val="single" w:sz="6" w:space="1" w:color="auto"/></w:pBdr></w:pPr></w:p>`,
      )
      continue
    }

    if (trimmed === "") {
      paragraphs.push(`<w:p/>`)
      continue
    }

    let runs = ""
    const parts = trimmed.split(/(\*\*[^*]+\*\*)/g)
    for (const part of parts) {
      if (part.startsWith("**") && part.endsWith("**")) {
        const inner = part.slice(2, -2)
        runs += `<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">${esc(inner)}</w:t></w:r>`
      } else if (part.length > 0) {
        runs += `<w:r><w:t xml:space="preserve">${esc(part)}</w:t></w:r>`
      }
    }
    paragraphs.push(`<w:p>${runs}</w:p>`)
  }

  return paragraphs.join("\n")
}

function buildDocx(markdown: string, title: string) {
  const body = md2paragraphs(markdown)

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/>
</Types>`

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`

  const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
</Relationships>`

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
${body}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="708" w:footer="708"/>
    </w:sectPr>
  </w:body>
</w:document>`

  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr><w:rFonts w:ascii="SimSun" w:hAnsi="SimSun" w:eastAsia="SimSun"/><w:sz w:val="21"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:pPr><w:spacing w:before="240" w:after="120"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="SimHei" w:hAnsi="SimHei" w:eastAsia="SimHei"/><w:b/><w:sz w:val="32"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:pPr><w:spacing w:before="200" w:after="100"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="SimHei" w:hAnsi="SimHei" w:eastAsia="SimHei"/><w:b/><w:sz w:val="28"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading3">
    <w:name w:val="heading 3"/>
    <w:pPr><w:spacing w:before="160" w:after="80"/></w:pPr>
    <w:rPr><w:rFonts w:ascii="SimHei" w:hAnsi="SimHei" w:eastAsia="SimHei"/><w:b/><w:sz w:val="24"/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="ListParagraph">
    <w:name w:val="List Paragraph"/>
    <w:pPr><w:ind w:left="720"/></w:pPr>
  </w:style>
</w:styles>`

  const numbering = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:abstractNum w:abstractNumId="0">
    <w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:abstractNum w:abstractNumId="1">
    <w:lvl w:ilvl="0"><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/><w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr></w:lvl>
  </w:abstractNum>
  <w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num>
  <w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>
</w:numbering>`

  const enc = (s: string) => new TextEncoder().encode(s)

  return zip([
    { name: "[Content_Types].xml", data: enc(contentTypes) },
    { name: "_rels/.rels", data: enc(rels) },
    { name: "word/_rels/document.xml.rels", data: enc(wordRels) },
    { name: "word/document.xml", data: enc(document) },
    { name: "word/styles.xml", data: enc(styles) },
    { name: "word/numbering.xml", data: enc(numbering) },
  ])
}

async function spawn(cmd: string[]) {
  const proc = Bun.spawn(cmd, { stdout: "ignore", stderr: "pipe" })
  const stderr = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code === 0) return
  throw new Error(`Pandoc failed (${code}): ${stderr.trim()}`)
}

async function pandoc(
  markdown: string,
  title: string,
  output: string,
  args: {
    markdownPath?: string
    referenceDoc?: string
    luaFilter?: string
    htmlPass: boolean
  },
  context: ToolContext,
) {
  if (!Bun.which("pandoc")) throw new Error("Pandoc executable not found. Install pandoc or use engine='native'.")

  const source = args.markdownPath ? resolve(context, args.markdownPath) : draft(context, title, ".md")
  if (args.markdownPath) {
    if (!(await Bun.file(source).exists())) throw new Error(`Markdown input not found: ${source}`)
  } else {
    await mkdir(path.dirname(source), { recursive: true })
    await Bun.write(source, markdown)
  }

  const reference = args.referenceDoc ?? process.env["RAILWISE_REFERENCE_DOC"]
  const filter = args.luaFilter ?? process.env["RAILWISE_PANDOC_LUA_FILTER"]
  const ref = reference ? resolve(context, reference) : undefined
  const lua = filter ? resolve(context, filter) : undefined

  if (ref && !(await Bun.file(ref).exists())) throw new Error(`Reference DOCX not found: ${ref}`)
  if (lua && !(await Bun.file(lua).exists())) throw new Error(`Lua filter not found: ${lua}`)

  const tail = [...(ref ? ["--reference-doc", ref] : []), ...(lua ? ["--lua-filter", lua] : [])]

  if (args.htmlPass) {
    const html = draft(context, title, ".html")
    await mkdir(path.dirname(html), { recursive: true })
    await spawn(["pandoc", source, "-f", "markdown", "-t", "html", "-o", html])
    await spawn(["pandoc", html, "-f", "html", "-o", output, ...tail])
    return { source, reference: ref, lua_filter: lua, html }
  }

  await spawn(["pandoc", source, "-f", "markdown", "-o", output, ...tail])
  return { source, reference: ref, lua_filter: lua }
}

export default tool({
  description:
    "将 Markdown 格式的监测报告转换为 .docx（Word）文件。technical_writer 完成报告编制后，调用此工具导出正式 Word 文件，可直接提交给业主或监理。支持原生导出，也支持 Pandoc reference-doc 模板导出。",
  args: {
    markdown: tool.schema.string().optional().describe("Markdown 格式的报告正文"),
    markdownPath: tool.schema.string().optional().describe("Markdown 文件路径；适合把已有 output/*.md 转换为 Word"),
    title: tool.schema.string().default("监测报告").describe("文档标题（用于文件名）"),
    outputPath: tool.schema
      .string()
      .optional()
      .describe("输出 .docx 文件路径；默认写入 output/runs/<session>/reports/[title].docx"),
    referenceDoc: tool.schema
      .string()
      .optional()
      .describe("Pandoc --reference-doc 模板 .docx 路径，可指向企业模板或 pandoc_docx_template fork"),
    luaFilter: tool.schema
      .string()
      .optional()
      .describe("Pandoc --lua-filter 路径，用于图片题注、字体颜色、行内代码等增强转换"),
    engine: tool.schema
      .enum(["auto", "pandoc", "native"])
      .default("auto")
      .describe("导出引擎：auto 有模板时用 Pandoc，否则用原生 DOCX；pandoc 强制用 Pandoc；native 强制用原生 DOCX"),
    htmlPass: tool.schema
      .boolean()
      .default(true)
      .describe("Pandoc 导出时先 Markdown→HTML 再 HTML→DOCX，以改善 HTML 标签兼容性"),
  },
  async execute(args, context) {
    const title = args.title ?? "监测报告"
    const engine = args.engine ?? "auto"
    const htmlPass = args.htmlPass ?? true
    const markdown =
      args.markdown ?? (args.markdownPath ? await Bun.file(resolve(context, args.markdownPath)).text() : "")
    if (args.markdown === undefined && !args.markdownPath)
      throw new Error("report_export requires markdown or markdownPath")

    const output = dest(context, title, args.outputPath)
    await mkdir(path.dirname(output), { recursive: true })
    const template = args.referenceDoc ?? process.env["RAILWISE_REFERENCE_DOC"]
    const filter = args.luaFilter ?? process.env["RAILWISE_PANDOC_LUA_FILTER"]
    const usePandoc = engine === "pandoc" || (engine === "auto" && Boolean(template || filter))
    const artifact = usePandoc
      ? await pandoc(
          markdown,
          title,
          output,
          {
            markdownPath: args.markdownPath,
            referenceDoc: template,
            luaFilter: filter,
            htmlPass,
          },
          context,
        )
      : undefined

    if (!usePandoc) await Bun.write(output, buildDocx(markdown, title))

    const stats = {
      paragraphs: (markdown.match(/\n/g)?.length ?? 0) + 1,
      chars: markdown.length,
      headings: (markdown.match(/^#{1,6}\s/gm) ?? []).length,
      lists: (markdown.match(/^(?:[-*]\s|\d+\.\s)/gm) ?? []).length,
    }

    return JSON.stringify({
      output_path: output,
      source_path: artifact?.source ?? args.markdownPath,
      reference_doc: artifact?.reference,
      lua_filter: artifact?.lua_filter,
      file_size_kb: Number(((await Bun.file(output).size) / 1024).toFixed(1)),
      engine: usePandoc ? "pandoc" : "native",
      format: usePandoc ? "docx (Pandoc reference-doc)" : "docx (Office Open XML)",
      content_stats: stats,
      message: `✅ 报告已导出为 Word 文件：${output}，包含 ${stats.headings} 个标题、${stats.paragraphs} 个段落。`,
    })
  },
})
