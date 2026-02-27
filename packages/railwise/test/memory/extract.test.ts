import { describe, test, expect } from "bun:test"
import { MemoryExtract } from "../../src/memory/extract"

describe("MemoryExtract.parse", () => {
  test("parses compaction summary sections", () => {
    const text = [
      "## Goal",
      "",
      "- Build a CLI tool",
      "- Support multiple commands",
      "",
      "## Discoveries",
      "",
      "- The config lives at ~/.railwise/config.json",
      "- Database uses SQLite via Drizzle",
      "",
      "## Accomplished",
      "",
      "- Created the schema file",
      "- Added migration",
      "",
      "## Relevant files",
      "",
      "- src/config/config.ts",
      "- src/storage/schema.ts",
    ].join("\n")

    const result = MemoryExtract.parse(text)
    expect(result.goal).toEqual(["Build a CLI tool", "Support multiple commands"])
    expect(result.discoveries).toEqual(["The config lives at ~/.railwise/config.json", "Database uses SQLite via Drizzle"])
    expect(result.accomplished).toEqual(["Created the schema file", "Added migration"])
    expect(result.files).toEqual(["src/config/config.ts", "src/storage/schema.ts"])
  })

  test("handles empty text", () => {
    const result = MemoryExtract.parse("")
    expect(result.goal).toEqual([])
    expect(result.discoveries).toEqual([])
    expect(result.accomplished).toEqual([])
    expect(result.files).toEqual([])
    expect(result.instructions).toEqual([])
  })

  test("handles sections with no content", () => {
    const text = "## Goal\n\n## Discoveries\n\n## Accomplished\n"
    const result = MemoryExtract.parse(text)
    expect(result.goal).toEqual([])
    expect(result.discoveries).toEqual([])
    expect(result.accomplished).toEqual([])
  })

  test("strips bullet prefixes", () => {
    const text = "## Discoveries\n\n- First item\n* Second item\n  Plain item\n"
    const result = MemoryExtract.parse(text)
    expect(result.discoveries).toEqual(["First item", "Second item", "Plain item"])
  })

  test("matches instruction section", () => {
    const text = "## Instructions\n\n- Use bun APIs\n- Follow AGENTS.md\n"
    const result = MemoryExtract.parse(text)
    expect(result.instructions).toEqual(["Use bun APIs", "Follow AGENTS.md"])
  })

  test("matches directory in files section", () => {
    const text = "## Relevant files / directories\n\n- src/memory/\n- src/config/config.ts\n"
    const result = MemoryExtract.parse(text)
    expect(result.files).toEqual(["src/memory/", "src/config/config.ts"])
  })
})

describe("MemoryExtract.similarity", () => {
  test("identical strings return 1", () => {
    expect(MemoryExtract.similarity("hello world", "hello world")).toBe(1)
  })

  test("completely different strings return 0", () => {
    expect(MemoryExtract.similarity("alpha beta", "gamma delta")).toBe(0)
  })

  test("partially overlapping strings return value between 0 and 1", () => {
    const score = MemoryExtract.similarity("the database uses SQLite", "the database uses PostgreSQL")
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThan(1)
  })

  test("empty strings return 1", () => {
    expect(MemoryExtract.similarity("", "")).toBe(1)
  })

  test("is case insensitive", () => {
    expect(MemoryExtract.similarity("Hello World", "hello world")).toBe(1)
  })

  test("ignores punctuation", () => {
    expect(MemoryExtract.similarity("hello, world!", "hello world")).toBe(1)
  })

  test("high similarity for near-duplicate memories", () => {
    const a = "The config file is located at src/config/config.ts"
    const b = "Config file located at src/config/config.ts"
    expect(MemoryExtract.similarity(a, b)).toBeGreaterThan(0.7)
  })

  test("low similarity for unrelated content", () => {
    const a = "Database migration uses Drizzle ORM with SQLite"
    const b = "Frontend components use React with TypeScript"
    expect(MemoryExtract.similarity(a, b)).toBeLessThan(0.3)
  })
})
