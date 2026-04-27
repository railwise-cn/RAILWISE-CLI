import path from "path"
import fs from "fs/promises"
import { Instance } from "@/project/instance"
import { Glob } from "@/util/glob"

export namespace NormWiki {
  export type Citation = {
    norm: string
    clause: string
    title?: string
  }

  export type Page = {
    path: string
    title: string
    text: string
    citations: Citation[]
  }

  export type Hit = Page & {
    score: number
    summary: string
  }

  const bundled = path.join(import.meta.dir, "library")

  async function exists(source: string) {
    return fs.access(source).then(
      () => true,
      () => false,
    )
  }

  export async function root() {
    if (Bun.env.RAILWISE_NORM_LIBRARY) return Bun.env.RAILWISE_NORM_LIBRARY
    const local = path.join(Instance.directory, ".railwise", "norm-library")
    if (await exists(local)) return local
    const project = path.join(Instance.worktree, ".railwise", "norm-library")
    if (await exists(project)) return project
    return bundled
  }

  function title(text: string, fallback: string) {
    return text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback
  }

  function citations(text: string): Citation[] {
    return Array.from(text.matchAll(/参照\s+([A-Z]+[A-Z0-9/-]*)\s+第\s+([0-9A-Za-z.条款款（）() -]+)\s*条/g)).map(
      (match) => ({
        norm: match[1],
        clause: match[2].trim(),
      }),
    )
  }

  function terms(query: string) {
    const normalized = query.toLowerCase().replace(/\s+/g, "")
    const ascii = query
      .toLowerCase()
      .match(/[a-z0-9]+/g)
      ?.filter((item) => item.length > 1)
    const chinese = query.match(/[\u4e00-\u9fff]{2,}/g)?.flatMap((item) => {
      const chars = [...item]
      return chars.flatMap((_, index) => {
        const pair = chars.slice(index, index + 2).join("")
        const triple = chars.slice(index, index + 3).join("")
        return [pair, triple].filter((part) => part.length > 1)
      })
    })
    return [...new Set([normalized, ...(ascii ?? []), ...(chinese ?? [])].filter(Boolean))]
  }

  function score(page: Page, query: string) {
    const haystack = `${page.title}\n${page.text}`.toLowerCase()
    return terms(query).reduce((acc, term) => {
      if (!term) return acc
      const weight = page.title.toLowerCase().includes(term) ? 5 : 1
      return acc + (haystack.match(new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"))?.length ?? 0) * weight
    }, 0)
  }

  function summary(text: string, query: string) {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter(Boolean)
    const token = terms(query).find((item) => item.length > 2)
    return paragraphs.find((item) => token && item.toLowerCase().includes(token)) ?? paragraphs[0] ?? ""
  }

  export async function pages(source?: string): Promise<Page[]> {
    source ??= await root()
    const dir = path.join(source, "wiki")
    if (!(await exists(dir))) return []
    const files = await Glob.scan("**/*.md", { cwd: dir, absolute: true, dot: true })
    return Promise.all(
      files
        .filter((file) => !file.endsWith("log.md"))
        .map(async (file) => {
          const text = await Bun.file(file).text()
          return {
            path: path.relative(source, file),
            title: title(text, path.basename(file, ".md")),
            text,
            citations: citations(text),
          }
        }),
    )
  }

  export async function query(input: { query: string; scope?: string; limit?: number; source?: string }) {
    const limit = Math.max(1, Math.min(input.limit ?? 5, 10))
    const scope = input.scope?.toLowerCase()
    return (await pages(input.source))
      .filter((page) => !scope || page.path.toLowerCase().includes(scope) || page.text.toLowerCase().includes(scope))
      .map((page) => ({ ...page, score: score(page, input.query), summary: summary(page.text, input.query) }))
      .filter((page) => page.score > 0)
      .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
      .slice(0, limit)
  }

  export async function appendLog(input: { query: string; hits: Hit[]; source?: string }) {
    const source = input.source ?? (await root())
    if (source === bundled) return false
    const file = path.join(source, "wiki", "log.md")
    const line = `- ${new Date().toISOString()} query=${JSON.stringify(input.query)} hits=${input.hits.map((hit) => hit.path).join(", ")}\n`
    const previous = (await exists(file)) ? await Bun.file(file).text() : "# Query Log\n\n"
    await Bun.write(file, previous.endsWith("\n") ? previous + line : `${previous}\n${line}`)
    return true
  }

  export function cite(input: { norm: string; clause: string; text: string }) {
    return `参照 ${input.norm} 第 ${input.clause} 条，${input.text.trim()}`
  }
}
