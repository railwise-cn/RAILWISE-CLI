import z from "zod"
import { Tool } from "./tool"
import { NormWiki } from "@/norm/wiki"

import QUERY_DESCRIPTION from "./wiki-query.txt"
import SEARCH_DESCRIPTION from "./norm-search.txt"
import CITE_DESCRIPTION from "./norm-cite.txt"

export const WikiQueryTool = Tool.define("tool_wiki_query", {
  description: QUERY_DESCRIPTION,
  parameters: z.object({
    query: z.string().min(1).describe("Natural-language norm question, e.g. CPIII 相邻点相对点位中误差限差是多少"),
    scope: z.string().optional().describe("Optional norm id or wiki path scope, e.g. TB10101 or clauses"),
    limit: z.number().int().min(1).max(10).optional().describe("Maximum hits to return. Defaults to 5."),
    appendLog: z.boolean().optional().describe("Append a query log entry when using a project norm library."),
  }),
  async execute(params) {
    const hits = await NormWiki.query(params)
    const logged = params.appendLog === false ? false : await NormWiki.appendLog({ query: params.query, hits })
    return {
      title: "Wiki Query",
      output: JSON.stringify(
        {
          query: params.query,
          hits: hits.map((hit) => ({
            path: hit.path,
            title: hit.title,
            score: hit.score,
            summary: hit.summary,
            citations: hit.citations,
            sourceRaw: hit.sourceRaw,
            normClauseId: hit.normClauseId,
            citationTriples: hit.citations.map((item) => ({
              wiki_page_path: hit.path,
              raw_source_md: hit.sourceRaw,
              norm_clause_id: `${item.norm} ${item.clause}`,
            })),
          })),
          logged,
        },
        null,
        2,
      ),
      metadata: {
        query: params.query,
        hitCount: hits.length,
        logged,
      },
    }
  },
})

export const WikiIngestTool = Tool.define("tool_wiki_ingest", {
  description: "Ingest a Raw layer markdown file into the RAILWISE norm Wiki and update index/log files.",
  parameters: z.object({
    rawPath: z.string().min(1).describe("Raw markdown path inside the norm library, e.g. raw/TB10101-2018/demo.md"),
    title: z.string().optional().describe("Optional title override for generated Wiki pages."),
    types: z
      .enum(["clause", "formula", "term", "case", "project", "faq"])
      .array()
      .optional()
      .describe("Wiki page types to create. Defaults to clause when a norm citation is found, otherwise case."),
    appendLog: z.boolean().optional().describe("Append an ingest log entry when using a project norm library."),
  }),
  async execute(params) {
    const result = await NormWiki.ingest(params)
    return {
      title: "Wiki Ingest",
      output: JSON.stringify(result, null, 2),
      metadata: {
        rawPath: result.rawPath,
        pageCount: result.pages.length,
      },
    }
  },
})

export const WikiIndexTool = Tool.define("tool_wiki_index", {
  description: "Regenerate wiki/index.md from the current RAILWISE norm Wiki pages.",
  parameters: z.object({}),
  async execute() {
    const result = await NormWiki.index()
    return {
      title: "Wiki Index",
      output: JSON.stringify(result, null, 2),
      metadata: result,
    }
  },
})

export const WikiLintTool = Tool.define("tool_wiki_lint", {
  description:
    "Check the RAILWISE norm Wiki for missing Raw links, missing citations, missing index entries, broken/projected links, orphan pages, stale pages, and numeric conflicts.",
  parameters: z.object({}),
  async execute() {
    const result = await NormWiki.lint()
    return {
      title: "Wiki Lint",
      output: JSON.stringify(result, null, 2),
      metadata: {
        ok: result.ok,
        problemCount: result.problemCount,
      },
    }
  },
})

export const NormSearchTool = Tool.define("tool_norm_search", {
  description: SEARCH_DESCRIPTION,
  parameters: z.object({
    query: z.string().min(1).describe("Natural-language or exact keyword query, e.g. CPIII 高程精度要求"),
    normFilter: z.array(z.string()).optional().describe("Optional norm ids, e.g. TB10101-2018 or GB50026."),
    norm_filter: z.array(z.string()).optional().describe("Alias for normFilter."),
    topK: z.number().int().min(1).max(20).optional().describe("Maximum results. Defaults to 5."),
    top_k: z.number().int().min(1).max(20).optional().describe("Alias for topK."),
  }),
  async execute(params) {
    const results = await NormWiki.search({
      query: params.query,
      normFilter: params.normFilter ?? params.norm_filter,
      topK: params.topK ?? params.top_k,
    })
    return {
      title: "Norm Search",
      output: JSON.stringify({ query: params.query, results }, null, 2),
      metadata: {
        query: params.query,
        resultCount: results.length,
      },
    }
  },
})

export const NormCiteTool = Tool.define("tool_norm_cite", {
  description: CITE_DESCRIPTION,
  parameters: z.object({
    norm: z.string().min(1).describe("Norm id, e.g. TB10101-2018"),
    clause: z.string().min(1).describe("Clause number, e.g. 5.4.3"),
    text: z.string().min(1).describe("Citation text to append after the clause reference."),
  }),
  async execute(params) {
    const citation = NormWiki.cite(params)
    return {
      title: "Norm Citation",
      output: citation,
      metadata: {
        norm: params.norm,
        clause: params.clause,
      },
    }
  },
})
