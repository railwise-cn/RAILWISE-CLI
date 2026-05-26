import { describe, expect, test } from "bun:test"
import path from "path"
import { tmpdir } from "../fixture/fixture"
import report_export from "../../../../.railwise/tool/report_export"
import type { ToolContext } from "nb-railwise/tool"

function context(dir: string): ToolContext {
  return {
    sessionID: "session.report",
    messageID: "message.report",
    agent: "technical_writer",
    directory: dir,
    worktree: dir,
    abort: new AbortController().signal,
    metadata() {},
    ask: async () => {},
  }
}

async function reference(dest: string) {
  const proc = Bun.spawn(["pandoc", "--print-default-data-file", "reference.docx"], { stdout: "pipe", stderr: "pipe" })
  const bytes = await new Response(proc.stdout).arrayBuffer()
  const error = await new Response(proc.stderr).text()
  const code = await proc.exited
  if (code !== 0) throw new Error(error)
  await Bun.write(dest, bytes)
}

describe("railwise report export tool", () => {
  test("writes default docx under the fixed output tree", async () => {
    await using tmp = await tmpdir()
    const result = JSON.parse(
      await report_export.execute(
        {
          markdown: "# 宁波轨道保护区监测月报\n\n本期监测正常。",
          title: "宁波轨道保护区监测月报",
          engine: "auto",
          htmlPass: true,
        },
        context(tmp.path),
      ),
    )

    expect(result.engine).toBe("native")
    expect(result.output_path).toContain(path.join("output", "runs", "session.report", "reports"))
    expect(result.output_path).toEndWith("宁波轨道保护区监测月报.docx")
    expect(await Bun.file(result.output_path).exists()).toBe(true)
  })

  test("exports markdown with a pandoc reference doc", async () => {
    if (!Bun.which("pandoc")) return

    await using tmp = await tmpdir()
    const ref = path.join(tmp.path, "reference.docx")
    const out = path.join(tmp.path, "template-report.docx")
    await reference(ref)

    const result = JSON.parse(
      await report_export.execute(
        {
          markdown: '# 模板报告\n\n<span style="color:red">红色预警</span>',
          title: "模板报告",
          outputPath: out,
          referenceDoc: ref,
          engine: "pandoc",
          htmlPass: true,
        },
        context(tmp.path),
      ),
    )

    expect(result.engine).toBe("pandoc")
    expect(result.reference_doc).toBe(ref)
    expect(result.output_path).toBe(out)
    expect(result.file_size_kb).toBeGreaterThan(0)
    expect(await Bun.file(out).exists()).toBe(true)
  })
})
