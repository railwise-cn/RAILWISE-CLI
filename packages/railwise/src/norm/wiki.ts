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

  export type Raw = {
    path: string
    title: string
    text: string
    citations: Citation[]
    hash: string
  }

  export type Page = {
    path: string
    title: string
    text: string
    citations: Citation[]
    sourceRaw?: string
    normClauseId?: string
    sourceHash?: string
    lastIngestAt?: string
  }

  export type Hit = Page & {
    score: number
    summary: string
  }

  export type LintProblem = {
    type: "missing_raw" | "missing_citation" | "missing_index" | "broken_link"
    path: string
    message: string
  }

  const dirs = {
    clause: "clauses",
    formula: "formulas",
    term: "terms",
    case: "cases",
    project: "projects",
    faq: "faq",
  } as const

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

  function hash(text: string) {
    return Bun.hash(text).toString(16)
  }

  function slug(text: string) {
    return (
      text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "page"
    )
  }

  function frontmatter(text: string) {
    if (!text.startsWith("---\n")) return { meta: {} as Record<string, string>, body: text }
    const end = text.indexOf("\n---", 4)
    if (end < 0) return { meta: {} as Record<string, string>, body: text }
    const block = text.slice(4, end)
    const meta = Object.fromEntries(
      block
        .split("\n")
        .map((line) => line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/))
        .filter((match): match is RegExpMatchArray => Boolean(match))
        .map((match) => [match[1], match[2].replace(/^"|"$/g, "")]),
    )
    return { meta, body: text.slice(text.indexOf("\n", end + 1) + 1) }
  }

  function citations(text: string): Citation[] {
    const chinese = Array.from(
      text.matchAll(/参照\s+([A-Z]+[A-Z0-9/-]*)\s+第\s+([0-9A-Za-z.条款款（）() -]+)\s*条/g),
    ).map((match) => ({
      norm: match[1],
      clause: match[2].trim(),
    }))
    const english = Array.from(text.matchAll(/Reference:\s*([A-Z]+[A-Z0-9/-]*)\s*,\s*clause\s*([0-9A-Za-z. -]+)/gi)).map(
      (match) => ({
        norm: match[1],
        clause: match[2].trim(),
      }),
    )
    return [...new Map([...chinese, ...english].map((item) => [`${item.norm}:${item.clause}`, item])).values()]
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

  function excerpt(text: string) {
    return text
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter((item) => item && !item.startsWith("#") && !item.startsWith("Reference:"))
      .slice(0, 5)
  }

  export async function pages(source?: string): Promise<Page[]> {
    source ??= await root()
    const dir = path.join(source, "wiki")
    if (!(await exists(dir))) return []
    const files = await Glob.scan("**/*.md", { cwd: dir, absolute: true, dot: true })
    return Promise.all(
      files
        .filter((file) => !file.endsWith("log.md") && !file.endsWith("index.md"))
        .map(async (file) => {
          const text = await Bun.file(file).text()
          const fm = frontmatter(text)
          return {
            path: path.relative(source, file),
            title: title(fm.body, path.basename(file, ".md")),
            text,
            citations: citations(fm.body),
            sourceRaw: fm.meta.source_raw,
            normClauseId: fm.meta.norm_clause_id,
            sourceHash: fm.meta.source_hash,
            lastIngestAt: fm.meta.last_ingest_at,
          }
        }),
    )
  }

  export async function raws(source?: string): Promise<Raw[]> {
    source ??= await root()
    const dir = path.join(source, "raw")
    if (!(await exists(dir))) return []
    const files = await Glob.scan("**/*.md", { cwd: dir, absolute: true, dot: true })
    return Promise.all(
      files.map(async (file) => {
        const text = await Bun.file(file).text()
        const fm = frontmatter(text)
        return {
          path: path.relative(source, file),
          title: title(fm.body, path.basename(file, ".md")),
          text,
          citations: citations(text),
          hash: hash(text),
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

  export async function index(input: { source?: string } = {}) {
    const source = input.source ?? (await root())
    const items = await pages(source)
    const raw = await raws(source)
    const groups = Object.entries(
      items.reduce(
        (acc, page) => ({
          ...acc,
          [page.path.split("/")[1] ?? "pages"]: [...(acc[page.path.split("/")[1] ?? "pages"] ?? []), page],
        }),
        {} as Record<string, Page[]>,
      ),
    ).sort(([a], [b]) => a.localeCompare(b))
    const content = [
      "# RAILWISE Norm Wiki Index",
      "",
      `Generated: ${new Date().toISOString()}`,
      "",
      "## Stats",
      "",
      `- pages: ${items.length}`,
      `- raw_sources: ${raw.length}`,
      "",
      ...groups.flatMap(([group, pages]) => [
        `## ${group}`,
        "",
        ...pages
          .sort((a, b) => a.path.localeCompare(b.path))
          .map(
            (page) =>
              `- [${page.title}](${page.path.replace(/^wiki\//, "")}): ${page.citations.map((item) => `${item.norm} ${item.clause}`).join(", ") || "no citation"}`,
          ),
        "",
      ]),
    ].join("\n")
    if (source !== bundled) {
      await fs.mkdir(path.join(source, "wiki"), { recursive: true })
      await Bun.write(path.join(source, "wiki", "index.md"), `${content}\n`)
    }
    return { pageCount: items.length, rawCount: raw.length, path: "wiki/index.md", readonly: source === bundled }
  }

  export async function ingest(input: {
    rawPath: string
    types?: (keyof typeof dirs)[]
    title?: string
    source?: string
    appendLog?: boolean
  }) {
    const source = input.source ?? (await root())
    const file = path.isAbsolute(input.rawPath) ? input.rawPath : path.join(source, input.rawPath)
    const rel = path.relative(source, file)
    if (rel.startsWith("..") || path.isAbsolute(rel)) throw new Error("rawPath must stay inside the norm library")
    if (!rel.startsWith("raw/")) throw new Error("rawPath must point to a Raw layer markdown file")
    if (source === bundled) throw new Error("Wiki ingest requires a project norm library; bundled demo data is read-only")
    const text = await Bun.file(file).text()
    const fm = frontmatter(text)
    const refs = citations(text)
    const body = excerpt(fm.body)
    const types = input.types?.length ? input.types : refs.length ? ["clause" as const] : ["case" as const]
    const name = input.title ?? title(fm.body, path.basename(file, ".md"))
    const time = new Date().toISOString()
    const created = await Promise.all(
      types.map(async (type) => {
        const ref = refs[0]
        const id = ref ? `${ref.norm}-${ref.clause}` : name
        const target = path.join(source, "wiki", dirs[type], `${slug(id)}.md`)
        await fs.mkdir(path.dirname(target), { recursive: true })
        await Bun.write(
          target,
          [
            "---",
            `source_raw: ${rel}`,
            ref ? `norm_clause_id: ${ref.norm} ${ref.clause}` : undefined,
            `source_hash: ${hash(text)}`,
            `last_ingest_at: ${time}`,
            "---",
            "",
            `# ${name}`,
            "",
            "This page was generated from the Raw layer markdown fallback. Review against the authorized source before signed deliverables.",
            "",
            ...refs.map((item) => cite({ norm: item.norm, clause: item.clause, text: "本页内容来自 Raw 层结构化源文件。" })),
            "",
            "## Raw Excerpt",
            "",
            ...(body.length ? body : ["No reviewed excerpt was found in the Raw source."]),
            "",
            "## Raw Source",
            "",
            `- source_raw: ${rel}`,
            `- source_hash: ${hash(text)}`,
            "",
          ]
            .filter((line): line is string => line !== undefined)
            .join("\n"),
        )
        return path.relative(source, target)
      }),
    )
    const indexed = await index({ source })
    if (input.appendLog !== false && source !== bundled) {
      const file = path.join(source, "wiki", "log.md")
      const previous = (await exists(file)) ? await Bun.file(file).text() : "# Query Log\n\n"
      const line = `## [${time.slice(0, 10)}] ingest | ${name} | pages=${created.join(", ")}\n\n`
      await Bun.write(file, previous.endsWith("\n") ? previous + line : `${previous}\n${line}`)
    }
    return { rawPath: rel, pages: created, index: indexed.path }
  }

  export async function lint(input: { source?: string } = {}) {
    const source = input.source ?? (await root())
    const items = await pages(source)
    const index = await Bun.file(path.join(source, "wiki", "index.md")).text().catch(() => "")
    const problems = (
      await Promise.all(
        items.map(async (page) => {
          const raw = page.sourceRaw ? path.join(source, page.sourceRaw) : undefined
          const missingRaw = page.sourceRaw && !(await exists(raw!))
          const links = Array.from(page.text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g))
            .map((match) => match[1])
            .filter((link) => !link.startsWith("http") && !link.startsWith("#"))
          const broken = await Promise.all(
            links.map(async (link) => {
              const target = path.normalize(path.join(source, path.dirname(page.path), link))
              return (await exists(target)) ? undefined : ({
                type: "broken_link",
                path: page.path,
                message: `Missing linked page: ${link}`,
              } satisfies LintProblem)
            }),
          )
          return [
            !page.sourceRaw && page.path.includes("/clauses/")
              ? { type: "missing_raw", path: page.path, message: "Clause page has no source_raw frontmatter." }
              : undefined,
            missingRaw ? { type: "missing_raw", path: page.path, message: `source_raw does not exist: ${page.sourceRaw}` } : undefined,
            page.path.includes("/clauses/") && page.citations.length === 0
              ? { type: "missing_citation", path: page.path, message: "Clause page has no norm citation." }
              : undefined,
            !index.includes(page.path.replace(/^wiki\//, ""))
              ? { type: "missing_index", path: page.path, message: "Page is not referenced by wiki/index.md." }
              : undefined,
            ...broken,
          ]
        }),
      )
    )
      .flat()
      .filter((item): item is LintProblem => Boolean(item))
    return { ok: problems.length === 0, problemCount: problems.length, problems }
  }
}
