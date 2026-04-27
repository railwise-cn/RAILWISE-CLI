import z from "zod"
import { Tool } from "./tool"
import { NormWiki } from "@/norm/wiki"

import QUERY_DESCRIPTION from "./wiki-query.txt"
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
