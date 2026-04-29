import { expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { MineruParseTool } from "../../src/tool/mineru"
import { tmpdir } from "../fixture/fixture"

function ctx() {
  return {
    sessionID: "session",
    messageID: "message",
    agent: "test",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    ask: async () => {},
  }
}

test("mineru parse tool copies reviewed markdown into raw fallback", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await Bun.write(
        path.join(dir, "tb10101-reviewed.md"),
        [
          "# CPIII 相邻点相对点位中误差",
          "",
          "CPIII 相邻点相对点位中误差不得超过 1 mm。",
          "",
          "Reference: TB10101-2018, clause 5.4.3",
          "",
        ].join("\n"),
      )
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const tool = await MineruParseTool.init()
      const result = JSON.parse(
        (
          await tool.execute(
            {
              inputPath: "tb10101-reviewed.md",
              outputDir: "raw/TB10101-2018",
              title: "TB10101-2018",
            },
            ctx(),
          )
        ).output,
      ) as {
        status: string
        parser: string
        rawPath: string
        manifestPath: string
        next: { tool: string; args: { rawPath: string } }
      }

      expect(result.status).toBe("parsed")
      expect(result.parser).toBe("markdown_fallback")
      expect(result.rawPath).toBe("raw/TB10101-2018/tb10101-reviewed.md")
      expect(result.next).toEqual({
        tool: "tool_wiki_ingest",
        args: { rawPath: "raw/TB10101-2018/tb10101-reviewed.md" },
      })

      const raw = path.join(tmp.path, ".railwise", "norm-library", result.rawPath)
      const manifest = path.join(tmp.path, ".railwise", "norm-library", result.manifestPath)
      expect(await Bun.file(raw).text()).toContain("Reference: TB10101-2018, clause 5.4.3")
      expect(await Bun.file(manifest).text()).toContain('"parser":"markdown_fallback"')
    },
  })
})

test("mineru parse tool rejects forced markdown fallback for binary sources", async () => {
  await using tmp = await tmpdir({
    init: async (dir) => {
      await fs.mkdir(path.join(dir, "docs"), { recursive: true })
      await Bun.write(path.join(dir, "docs", "standard.pdf"), "fake pdf")
    },
  })
  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const tool = await MineruParseTool.init()
      const result = JSON.parse(
        (
          await tool.execute(
            {
              inputPath: "docs/standard.pdf",
              mode: "markdown_fallback",
            },
            ctx(),
          )
        ).output,
      ) as { status: string; message: string }

      expect(result.status).toBe("unsupported")
      expect(result.message).toContain("Markdown fallback only accepts")
    },
  })
})
