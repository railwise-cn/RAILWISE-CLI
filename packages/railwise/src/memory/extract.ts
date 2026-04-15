import { Log } from "@/util/log"
import { Memory } from "./memory"
import { Session } from "@/session"
import { MessageV2 } from "@/session/message-v2"
import { Config } from "@/config/config"

const log = Log.create({ service: "memory.extract" })

export namespace MemoryExtract {
  interface Section {
    goal: string[]
    instructions: string[]
    discoveries: string[]
    accomplished: string[]
    files: string[]
  }

  export async function fromCompaction(input: { sessionID: string; projectID: string }) {
    const config = await Config.get()
    if (config.memory?.enabled === false) return
    if (config.memory?.autoCapture === false) return

    const summary = await findCompactionSummary(input.sessionID)
    if (!summary) return

    log.info("extracting from compaction", { sessionID: input.sessionID })
    const sections = parse(summary)
    const memories: { category: Memory.Category; content: string; confidence: number }[] = []

    for (const item of sections.discoveries) {
      if (item.trim().length < 10) continue
      memories.push({ category: "discovery", content: item.trim(), confidence: 0.8 })
    }

    for (const item of sections.goal) {
      if (item.trim().length < 10) continue
      memories.push({ category: "decision", content: item.trim(), confidence: 0.9 })
    }

    for (const item of sections.instructions) {
      if (item.trim().length < 10) continue
      memories.push({ category: "pattern", content: item.trim(), confidence: 0.7 })
    }

    for (const item of sections.accomplished) {
      if (item.trim().length < 10) continue
      memories.push({ category: "fact", content: item.trim(), confidence: 0.75 })
    }

    const existing = await Memory.list({ projectID: input.projectID, limit: 200 })
    let added = 0

    for (const candidate of memories) {
      const duplicate = existing.find((m) => similarity(m.content, candidate.content) > 0.7)
      if (duplicate) {
        await Memory.boost({ id: duplicate.id, delta: 0.1 })
        continue
      }
      await Memory.add({
        projectID: input.projectID,
        sessionID: input.sessionID,
        category: candidate.category,
        content: candidate.content,
        source: `compaction:${input.sessionID}`,
        confidence: candidate.confidence,
      })
      added++
    }

    log.info("extracted", { added, skipped: memories.length - added })
  }

  async function findCompactionSummary(sessionID: string) {
    const msgs = await Session.messages({ sessionID, limit: 50 })
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i]
      if (msg.info.role !== "assistant") continue
      if (!(msg.info as MessageV2.Assistant).summary) continue

      const texts = msg.parts
        .filter((p): p is MessageV2.TextPart => p.type === "text")
        .map((p) => p.text)
        .join("\n")

      if (texts.length > 50) return texts
    }
    return undefined
  }

  export function parse(text: string): Section {
    const result: Section = { goal: [], instructions: [], discoveries: [], accomplished: [], files: [] }
    const sections = text.split(/^##\s+/m)

    for (const section of sections) {
      const lines = section.split("\n")
      const header = lines[0]?.toLowerCase().trim() ?? ""
      const body = lines
        .slice(1)
        .map((l) => l.replace(/^[-*]\s+/, "").trim())
        .filter((l) => l.length > 0)

      if (header.includes("goal")) result.goal = body
      if (header.includes("instruction")) result.instructions = body
      if (header.includes("discover")) result.discoveries = body
      if (header.includes("accomplish")) result.accomplished = body
      if (header.includes("file") || header.includes("director")) result.files = body
    }

    return result
  }

  export function similarity(a: string, b: string) {
    const setA = new Set(tokenize(a))
    const setB = new Set(tokenize(b))
    if (setA.size === 0 && setB.size === 0) return 1
    let intersection = 0
    for (const token of setA) {
      if (setB.has(token)) intersection++
    }
    return intersection / (setA.size + setB.size - intersection)
  }

  function tokenize(text: string) {
    return text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1)
  }
}
