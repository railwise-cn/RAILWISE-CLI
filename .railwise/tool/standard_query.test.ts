/// <reference path="../env.d.ts" />
import { describe, expect, test } from "bun:test"
import { query_standard, list_standards } from "./standard_query"

const ctx: any = { sessionID: "", messageID: "", agent: "", directory: "", worktree: "", abort: new AbortController().signal, metadata() {}, ask: async () => {} }

function parse(json: string) {
  return JSON.parse(json)
}

describe("query_standard", () => {
  test("finds clauses by keyword '报警值'", async () => {
    const r = parse(await query_standard.execute({ keywords: ["报警值"], standardCode: "all", mandatoryOnly: false }, ctx))
    expect(r.total_matches).toBeGreaterThan(0)
    expect(r.results.some((c: any) => c.content.includes("报警值"))).toBe(true)
  })

  test("filters by specific standard code", async () => {
    const r = parse(await query_standard.execute({ keywords: ["监测频率"], standardCode: "GB 50911", mandatoryOnly: false }, ctx))
    expect(r.results.every((c: any) => c.code === "GB 50911")).toBe(true)
  })

  test("mandatory-only filter works", async () => {
    const r = parse(await query_standard.execute({ keywords: ["监测"], standardCode: "all", mandatoryOnly: true }, ctx))
    expect(r.results.every((c: any) => c.mandatory === true)).toBe(true)
  })

  test("returns empty for unrelated keywords", async () => {
    const r = parse(await query_standard.execute({ keywords: ["量子计算", "火星探测"], standardCode: "all", mandatoryOnly: false }, ctx))
    expect(r.results).toHaveLength(0)
  })

  test("multiple keywords improve relevance", async () => {
    const r = parse(await query_standard.execute({ keywords: ["基坑", "围护墙", "水平位移"], standardCode: "all", mandatoryOnly: false }, ctx))
    expect(r.total_matches).toBeGreaterThan(0)
    expect(r.results[0].code).toBe("GB 50497")
  })

  test("section number search returns exact match", async () => {
    const r = parse(await query_standard.execute({ keywords: ["5.0.1"], standardCode: "GB 50497", mandatoryOnly: false }, ctx))
    expect(r.results[0].section).toBe("5.0.1")
  })

  test("returns at most 8 results", async () => {
    const r = parse(await query_standard.execute({ keywords: ["监测"], standardCode: "all", mandatoryOnly: false }, ctx))
    expect(r.returned).toBeLessThanOrEqual(8)
  })

  test("results are sorted by relevance (descending)", async () => {
    const r = parse(await query_standard.execute({ keywords: ["水准", "闭合差"], standardCode: "all", mandatoryOnly: false }, ctx))
    for (let i = 1; i < r.results.length; i++) {
      expect(r.results[i - 1].relevance).toBeGreaterThanOrEqual(r.results[i].relevance)
    }
  })

  test("JGJ 8 clauses are searchable", async () => {
    const r = parse(await query_standard.execute({ keywords: ["倾斜", "建筑高度"], standardCode: "JGJ 8", mandatoryOnly: false }, ctx))
    expect(r.total_matches).toBeGreaterThan(0)
    expect(r.results[0].code).toBe("JGJ 8")
  })

  test("GB 50026 导线 clauses", async () => {
    const r = parse(await query_standard.execute({ keywords: ["导线", "角度闭合差"], standardCode: "GB 50026", mandatoryOnly: false }, ctx))
    expect(r.total_matches).toBeGreaterThan(0)
    expect(r.results[0].content).toContain("DJ")
  })
})

describe("list_standards", () => {
  test("lists all 4 standards", async () => {
    const r = parse(await list_standards.execute({} as any, ctx))
    expect(r.standards).toHaveLength(4)
    expect(r.total_clauses).toBeGreaterThan(20)
  })

  test("each standard has clause counts", async () => {
    const r = parse(await list_standards.execute({} as any, ctx))
    for (const s of r.standards) {
      expect(s.total_clauses).toBeGreaterThan(0)
      expect(s.code).toBeDefined()
      expect(s.title).toBeDefined()
    }
  })
})
