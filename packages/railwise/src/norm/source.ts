import fs from "fs/promises"
import path from "path"
import { Instance } from "@/project/instance"

export namespace NormSource {
  export type Mode = "auto" | "markdown_fallback" | "mineru"

  export type Result = {
    status: "parsed" | "mineru_ready" | "needs_markdown_fallback" | "unsupported"
    parser: "markdown_fallback" | "mineru"
    inputPath: string
    rawPath?: string
    rawAbsolutePath?: string
    manifestPath?: string
    sourceHash?: string
    mineru: {
      available: boolean
      command?: string
      path?: string
    }
    next?: {
      tool: "tool_wiki_ingest"
      args: { rawPath: string }
    }
    message: string
  }

  const markdown = new Set([".md", ".markdown", ".txt"])
  const commands = ["mineru", "magic-pdf"] as const
  type Command = { command: (typeof commands)[number]; path: string }

  async function exists(source: string) {
    return fs.access(source).then(
      () => true,
      () => false,
    )
  }

  function root() {
    const base = Instance.worktree === "/" ? Instance.directory : Instance.worktree
    return path.join(base, ".railwise", "norm-library")
  }

  function hash(text: string) {
    return Bun.hash(text).toString(16)
  }

  function slug(text: string) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "source"
    )
  }

  async function command(name: (typeof commands)[number]) {
    const proc = Bun.spawn(["/usr/bin/env", "sh", "-lc", `command -v ${name}`], {
      stdout: "pipe",
      stderr: "ignore",
    })
    const out = await new Response(proc.stdout).text()
    const code = await proc.exited
    if (code !== 0) return undefined
    const found = out.trim()
    if (!found) return undefined
    return { command: name, path: found }
  }

  export async function mineru() {
    const found = (await Promise.all(commands.map(command))).find((item): item is Command => Boolean(item))
    return {
      available: Boolean(found),
      command: found?.command,
      path: found?.path,
    }
  }

  function output(input: { outputDir?: string; title?: string }, source: string, filepath: string) {
    const ext = path.extname(filepath)
    const name = slug(path.basename(filepath, ext))
    const rawDir = input.outputDir
      ? input.outputDir.startsWith("raw/")
        ? input.outputDir
        : path.join("raw", input.outputDir)
      : path.join("raw", slug(input.title ?? path.basename(filepath, ext)))
    const target = path.join(source, rawDir, `${name}.md`)
    const rel = path.relative(source, target)
    if (rel.startsWith("..") || path.isAbsolute(rel) || !rel.startsWith("raw/")) {
      throw new Error("outputDir must stay inside the norm-library raw/ directory")
    }
    return { target, rel }
  }

  async function manifest(source: string, entry: Record<string, unknown>) {
    const file = path.join(source, "raw", "manifest.jsonl")
    const previous = (await exists(file)) ? await Bun.file(file).text() : ""
    await fs.mkdir(path.dirname(file), { recursive: true })
    await Bun.write(file, `${previous}${JSON.stringify(entry)}\n`)
    return path.relative(source, file)
  }

  export async function parse(input: {
    inputPath: string
    outputDir?: string
    title?: string
    mode?: Mode
  }): Promise<Result> {
    const mode = input.mode ?? "auto"
    const source = root()
    const filepath = path.isAbsolute(input.inputPath)
      ? input.inputPath
      : path.resolve(Instance.directory, input.inputPath)
    if (!(await exists(filepath))) throw new Error(`inputPath does not exist: ${input.inputPath}`)

    const bin = await mineru()
    const ext = path.extname(filepath).toLowerCase()
    const fallback = markdown.has(ext)

    if (fallback && mode !== "mineru") {
      const text = await Bun.file(filepath).text()
      const target = output(input, source, filepath)
      await fs.mkdir(path.dirname(target.target), { recursive: true })
      await Bun.write(target.target, text)
      const digest = hash(text)
      const trace = await manifest(source, {
        at: new Date().toISOString(),
        status: "parsed",
        parser: "markdown_fallback",
        input_path: filepath,
        raw_path: target.rel,
        source_hash: digest,
        title: input.title,
        mineru_available: bin.available,
      })
      return {
        status: "parsed",
        parser: "markdown_fallback",
        inputPath: filepath,
        rawPath: target.rel,
        rawAbsolutePath: target.target,
        manifestPath: trace,
        sourceHash: digest,
        mineru: bin,
        next: {
          tool: "tool_wiki_ingest",
          args: { rawPath: target.rel },
        },
        message: "Reviewed markdown was copied into the Raw layer and is ready for tool_wiki_ingest.",
      }
    }

    if (mode === "markdown_fallback") {
      return {
        status: "unsupported",
        parser: "markdown_fallback",
        inputPath: filepath,
        mineru: bin,
        message:
          "Markdown fallback only accepts .md, .markdown, or .txt files. Convert this source to reviewed markdown first.",
      }
    }

    if (bin.available) {
      return {
        status: "mineru_ready",
        parser: "mineru",
        inputPath: filepath,
        mineru: bin,
        message:
          "MinerU is available locally. Full binary/MCP parsing is reserved for the next integration step; use reviewed markdown fallback for M8 ingestion.",
      }
    }

    return {
      status: "needs_markdown_fallback",
      parser: "mineru",
      inputPath: filepath,
      mineru: bin,
      message:
        "MinerU was not found on PATH. Provide a reviewed markdown export and rerun with mode=markdown_fallback or input a .md/.markdown/.txt file.",
    }
  }
}
