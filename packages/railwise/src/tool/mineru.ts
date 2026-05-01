import z from "zod"
import { Tool } from "./tool"
import { NormSource } from "@/norm/source"

import DESCRIPTION from "./mineru-parse.txt"

export const MineruParseTool = Tool.define("tool_mineru_parse", {
  description: DESCRIPTION,
  parameters: z.object({
    inputPath: z
      .string()
      .min(1)
      .describe("Source document path. Markdown/text files are copied into the Raw layer fallback."),
    outputDir: z
      .string()
      .optional()
      .describe("Optional output directory inside norm-library/raw, e.g. raw/TB10101-2018 or TB10101-2018."),
    title: z.string().optional().describe("Optional source title used for the default Raw directory name."),
    mode: z
      .enum(["auto", "markdown_fallback", "mineru"])
      .optional()
      .describe("auto uses Markdown fallback for reviewed markdown/text and detects MinerU for other files."),
  }),
  async execute(params) {
    const result = await NormSource.parse(params)
    return {
      title: "MinerU Parse",
      output: JSON.stringify(result, null, 2),
      metadata: {
        status: result.status,
        parser: result.parser,
        rawPath: result.rawPath,
        mineruAvailable: result.mineru.available,
      },
    }
  },
})
