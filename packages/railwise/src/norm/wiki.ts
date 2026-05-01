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
    supersededBy?: string
  }

  export type Hit = Page & {
    score: number
    summary: string
  }

  export type SearchHit = {
    normId: string
    chapter: string
    title: string
    content: string
    score: number
    path: string
    sourceRaw?: string
    normClauseId?: string
  }

  export type LogEntry = {
    kind: "query" | "ingest" | "other"
    timestamp?: string
    title: string
    paths: string[]
    raw: string
  }

  export type LintProblem = {
    type:
      | "missing_raw"
      | "missing_citation"
      | "missing_index"
      | "broken_link"
      | "projected_page"
      | "orphan_page"
      | "conflict"
      | "stale_page"
    path: string
    message: string
  }

  export type LintResult = {
    ok: boolean
    problemCount: number
    problems: LintProblem[]
    reportPath?: string
  }

  export type DiffChange = {
    type: "added" | "removed" | "modified" | "superseded"
    key: string
    title: string
    fromPath?: string
    toPath?: string
    fromHash?: string
    toHash?: string
    summary: string
  }

  export type DiffResult = {
    fromScope: string
    toScope: string
    changeCount: number
    changes: DiffChange[]
    reportPath?: string
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
    const english = Array.from(
      text.matchAll(/Reference:\s*([A-Z]+[A-Z0-9/-]*)\s*,\s*clause\s*([0-9A-Za-z. -]+)/gi),
    ).map((match) => ({
      norm: match[1],
      clause: match[2].trim(),
    }))
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
        .filter((file) => {
          const rel = path.relative(dir, file)
          return !rel.endsWith("log.md") && !rel.endsWith("index.md") && !rel.startsWith(`changes${path.sep}`)
        })
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
            supersededBy: fm.meta.supersededBy ?? fm.meta.superseded_by,
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

  function normkey(text: string) {
    return text.toLowerCase().replace(/\s+/g, "")
  }

  function pagekey(text: string) {
    return (
      text
        .toLowerCase()
        .replace(/\.md$/, "")
        .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "") || slug(text)
    )
  }

  function linkpath(page: Page, link: string) {
    if (link.startsWith("http") || link.startsWith("#")) return undefined
    const clean = link.split("#")[0]?.split("?")[0]
    if (!clean) return undefined
    const rel = path.normalize(path.join(path.dirname(page.path), clean))
    if (rel.startsWith("..") || path.isAbsolute(rel)) return undefined
    return rel
  }

  function wikilinks(text: string) {
    return Array.from(text.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)).map((match) => match[1].trim())
  }

  function clauseid(page: Page) {
    const first = page.citations[0]
    return page.normClauseId ?? (first ? `${first.norm} ${first.clause}` : undefined)
  }

  function clausekey(page: Page) {
    const first = page.citations[0]
    if (first?.clause) return first.clause
    const id = page.normClauseId?.split(/\s+/).slice(1).join(" ")
    return id || pagekey(page.title)
  }

  function scoped(page: Page, scope: string) {
    const key = normkey(scope)
    return normkey(
      `${page.path} ${page.title} ${page.sourceRaw ?? ""} ${page.normClauseId ?? ""} ${page.text}`,
    ).includes(key)
  }

  function values(text: string) {
    return [
      ...new Set(
        Array.from(text.matchAll(/(-?\d+(?:\.\d+)?)\s*(mm|cm|m|%|毫米|厘米|米)/gi)).map(
          (match) => `${Number(match[1])} ${match[2].toLowerCase()}`,
        ),
      ),
    ]
  }

  function lintReport(problems: LintProblem[]) {
    const groups = Object.entries(
      problems.reduce(
        (acc, problem) => ({
          ...acc,
          [problem.type]: [...(acc[problem.type] ?? []), problem],
        }),
        {} as Record<LintProblem["type"], LintProblem[]>,
      ),
    ).sort(([a], [b]) => a.localeCompare(b))
    return [
      "# RAILWISE Norm Wiki Lint Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      `Status: ${problems.length === 0 ? "ok" : "needs_attention"}`,
      `Problem count: ${problems.length}`,
      "",
      "## Summary",
      "",
      ...(groups.length ? groups.map(([type, items]) => `- ${type}: ${items.length}`) : ["- no problems found"]),
      "",
      "## Problems",
      "",
      ...(groups.length
        ? groups.flatMap(([type, items]) => [
            `### ${type}`,
            "",
            ...items.map((item) => `- ${item.path}: ${item.message}`),
            "",
          ])
        : ["No lint findings were detected.", ""]),
    ].join("\n")
  }

  async function writeLintReport(source: string, problems: LintProblem[]) {
    if (source === bundled) return undefined
    const rel = path.join("wiki", "changes", `lint-${new Date().toISOString().slice(0, 10)}.md`)
    const file = path.join(source, rel)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await Bun.write(file, `${lintReport(problems)}\n`)
    return rel
  }

  function diffReport(input: { fromScope: string; toScope: string; changes: DiffChange[] }) {
    const groups = Object.entries(
      input.changes.reduce(
        (acc, change) => ({
          ...acc,
          [change.type]: [...(acc[change.type] ?? []), change],
        }),
        {} as Record<DiffChange["type"], DiffChange[]>,
      ),
    ).sort(([a], [b]) => a.localeCompare(b))
    return [
      "# RAILWISE Norm Wiki Change Report",
      "",
      `Generated: ${new Date().toISOString()}`,
      `From: ${input.fromScope}`,
      `To: ${input.toScope}`,
      `Change count: ${input.changes.length}`,
      "",
      "## Summary",
      "",
      ...(groups.length ? groups.map(([type, items]) => `- ${type}: ${items.length}`) : ["- no changes detected"]),
      "",
      "## Changes",
      "",
      ...(groups.length
        ? groups.flatMap(([type, items]) => [
            `### ${type}`,
            "",
            ...items.map((item) => `- ${item.key} | ${item.title}: ${item.summary}`),
            "",
          ])
        : ["No changes were detected.", ""]),
    ].join("\n")
  }

  async function writeDiffReport(source: string, input: { fromScope: string; toScope: string; changes: DiffChange[] }) {
    if (source === bundled) return undefined
    const rel = path.join(
      "wiki",
      "changes",
      `diff-${slug(input.fromScope)}-to-${slug(input.toScope)}-${new Date().toISOString().slice(0, 10)}.md`,
    )
    const file = path.join(source, rel)
    await fs.mkdir(path.dirname(file), { recursive: true })
    await Bun.write(file, `${diffReport(input)}\n`)
    return rel
  }

  export async function search(input: { query: string; normFilter?: string[]; topK?: number; source?: string }) {
    const limit = Math.max(1, Math.min(input.topK ?? 5, 20))
    const filter = input.normFilter?.map(normkey)
    const entries = [
      ...(await pages(input.source)).map((page) => ({
        path: page.path,
        title: page.title,
        text: page.text,
        citations: page.citations,
        sourceRaw: page.sourceRaw,
        normClauseId: page.normClauseId,
      })),
      ...(await raws(input.source)).map((raw) => ({
        path: raw.path,
        title: raw.title,
        text: raw.text,
        citations: raw.citations,
        sourceRaw: raw.path,
        normClauseId: raw.citations[0] ? `${raw.citations[0].norm} ${raw.citations[0].clause}` : undefined,
      })),
    ]
    return entries
      .filter(
        (entry) =>
          !filter?.length ||
          entry.citations.some((item) => filter.includes(normkey(item.norm))) ||
          filter.some((item) => normkey(entry.path).includes(item)),
      )
      .map((entry) => {
        const refs = entry.citations
        const first = refs[0]
        const parts = entry.normClauseId?.split(/\s+/)
        return {
          normId: first?.norm ?? parts?.[0] ?? entry.path.split("/")[1]?.toUpperCase() ?? "UNKNOWN",
          chapter: first?.clause ?? parts?.slice(1).join(" ") ?? "",
          title: entry.title,
          content: summary(entry.text, input.query),
          score: score({ ...entry, path: entry.path }, input.query),
          path: entry.path,
          sourceRaw: entry.sourceRaw,
          normClauseId: entry.normClauseId,
        } satisfies SearchHit
      })
      .filter((hit) => hit.score > 0)
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

  function logEntry(line: string): LogEntry | undefined {
    const query = line.match(/^- ([^ ]+) query="((?:\\.|[^"])*)" hits=(.*)$/)
    if (query) {
      return {
        kind: "query",
        timestamp: query[1],
        title: query[2].replace(/\\"/g, '"'),
        paths: query[3]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        raw: line,
      }
    }
    const ingest = line.match(/^## \[([^\]]+)] ingest \| (.+) \| pages=(.*)$/)
    if (ingest) {
      return {
        kind: "ingest",
        timestamp: ingest[1],
        title: ingest[2].trim(),
        paths: ingest[3]
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        raw: line,
      }
    }
    const title = line.replace(/^[-# ]+/, "").trim()
    if (!title) return undefined
    return { kind: "other", title, paths: [], raw: line }
  }

  export async function logs(input: { limit?: number; source?: string } = {}) {
    const source = input.source ?? (await root())
    const file = path.join(source, "wiki", "log.md")
    if (!(await exists(file))) return []
    const limit = Math.max(1, Math.min(input.limit ?? 10, 50))
    return (await Bun.file(file).text())
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.startsWith("- ") || line.startsWith("## ["))
      .map(logEntry)
      .filter((entry): entry is LogEntry => Boolean(entry))
      .reverse()
      .slice(0, limit)
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
    if (source === bundled)
      throw new Error("Wiki ingest requires a project norm library; bundled demo data is read-only")
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
            ...refs.map((item) =>
              cite({ norm: item.norm, clause: item.clause, text: "本页内容来自 Raw 层结构化源文件。" }),
            ),
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

  export async function diff(input: {
    fromScope: string
    toScope: string
    source?: string
    writeReport?: boolean
  }): Promise<DiffResult> {
    const source = input.source ?? (await root())
    const all = await pages(source)
    const from = all.filter((page) => scoped(page, input.fromScope))
    const to = all.filter((page) => scoped(page, input.toScope))
    const base = new Map(from.map((page) => [clausekey(page), page]))
    const target = new Map(to.map((page) => [clausekey(page), page]))
    const keys = [...new Set([...base.keys(), ...target.keys()])].sort((a, b) => a.localeCompare(b))
    const changes = keys.flatMap((key): DiffChange[] => {
      const before = base.get(key)
      const after = target.get(key)
      if (!before && after) {
        return [
          {
            type: "added",
            key,
            title: after.title,
            toPath: after.path,
            toHash: after.sourceHash ?? hash(after.text),
            summary: `Added in ${input.toScope}: ${after.path}`,
          },
        ]
      }
      if (before && !after) {
        return [
          {
            type: "removed",
            key,
            title: before.title,
            fromPath: before.path,
            fromHash: before.sourceHash ?? hash(before.text),
            summary: `Removed from ${input.toScope}: ${before.path}`,
          },
        ]
      }
      if (!before || !after) return []
      const old = before.sourceHash ?? hash(before.text)
      const next = after.sourceHash ?? hash(after.text)
      if (old === next && !before.supersededBy) return []
      return [
        {
          type: before.supersededBy ? "superseded" : "modified",
          key,
          title: after.title,
          fromPath: before.path,
          toPath: after.path,
          fromHash: old,
          toHash: next,
          summary: before.supersededBy
            ? `${before.path} is superseded by ${before.supersededBy}.`
            : `Content changed between ${before.path} and ${after.path}.`,
        },
      ]
    })
    const reportPath = input.writeReport ? await writeDiffReport(source, { ...input, changes }) : undefined
    return {
      fromScope: input.fromScope,
      toScope: input.toScope,
      changeCount: changes.length,
      changes,
      ...(reportPath && { reportPath }),
    }
  }

  export async function lint(input: { source?: string; writeReport?: boolean } = {}): Promise<LintResult> {
    const source = input.source ?? (await root())
    const items = await pages(source)
    const index = await Bun.file(path.join(source, "wiki", "index.md"))
      .text()
      .catch(() => "")
    const paths = new Set(items.map((page) => page.path))
    const aliases = new Map(
      items.flatMap((page) => [
        [pagekey(page.title), page.path],
        [pagekey(path.basename(page.path)), page.path],
      ]),
    )
    const incoming = new Map(items.map((page) => [page.path, new Set<string>()]))
    const problems = (
      await Promise.all(
        items.map(async (page) => {
          const raw = page.sourceRaw ? path.join(source, page.sourceRaw) : undefined
          const missingRaw = page.sourceRaw && !(await exists(raw!))
          const links = Array.from(page.text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)).map((match) => match[1])
          const broken = links.flatMap((link): LintProblem[] => {
            const target = linkpath(page, link)
            if (!target) return []
            if (paths.has(target)) {
              incoming.get(target)?.add(page.path)
              return []
            }
            return [
              {
                type: "broken_link",
                path: page.path,
                message: `Missing linked page: ${link}`,
              },
            ]
          })
          const projected = wikilinks(page.text).flatMap((link): LintProblem[] => {
            const target = aliases.get(pagekey(link))
            if (target) {
              incoming.get(target)?.add(page.path)
              return []
            }
            return [
              {
                type: "projected_page",
                path: page.path,
                message: `Wiki link has no matching page: ${link}`,
              },
            ]
          })
          return [
            !page.sourceRaw && page.path.includes("/clauses/")
              ? { type: "missing_raw", path: page.path, message: "Clause page has no source_raw frontmatter." }
              : undefined,
            missingRaw
              ? { type: "missing_raw", path: page.path, message: `source_raw does not exist: ${page.sourceRaw}` }
              : undefined,
            page.path.includes("/clauses/") && page.citations.length === 0
              ? { type: "missing_citation", path: page.path, message: "Clause page has no norm citation." }
              : undefined,
            !index.includes(page.path.replace(/^wiki\//, ""))
              ? { type: "missing_index", path: page.path, message: "Page is not referenced by wiki/index.md." }
              : undefined,
            page.supersededBy
              ? { type: "stale_page", path: page.path, message: `Page is superseded by ${page.supersededBy}.` }
              : undefined,
            ...broken,
            ...projected,
          ]
        }),
      )
    )
      .flat()
      .filter((item): item is LintProblem => Boolean(item))
    const conflicts = Object.values(
      items.reduce(
        (acc, page) => {
          const id = clauseid(page)
          if (!id) return acc
          return {
            ...acc,
            [id]: [...(acc[id] ?? []), page],
          }
        },
        {} as Record<string, Page[]>,
      ),
    )
      .filter((group) => group.length > 1)
      .map((group) => ({
        pages: group,
        claims: group.flatMap((page) => values(page.text).map((value) => ({ page, value }))),
      }))
      .filter((group) => new Set(group.claims.map((claim) => claim.value)).size > 1)
      .map(
        (group) =>
          ({
            type: "conflict",
            path: group.pages[0].path,
            message: `Conflicting numeric claims for ${clauseid(group.pages[0])}: ${group.claims
              .map((claim) => `${claim.value} in ${claim.page.path}`)
              .join("; ")}`,
          }) satisfies LintProblem,
      )
    const orphans =
      items.length < 2
        ? []
        : items
            .filter((page) => (incoming.get(page.path)?.size ?? 0) === 0)
            .map(
              (page) =>
                ({
                  type: "orphan_page",
                  path: page.path,
                  message: "Page has no incoming links from other Wiki pages.",
                }) satisfies LintProblem,
            )
    problems.push(...conflicts, ...orphans)
    const reportPath = input.writeReport ? await writeLintReport(source, problems) : undefined
    return { ok: problems.length === 0, problemCount: problems.length, problems, ...(reportPath && { reportPath }) }
  }
}
