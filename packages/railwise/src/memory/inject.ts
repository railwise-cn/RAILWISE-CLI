import { Config } from "@/config/config"
import { Memory } from "./memory"
import { Log } from "@/util/log"

const log = Log.create({ service: "memory.inject" })

export namespace MemoryInject {
  export async function system(input: { projectID: string }): Promise<string[]> {
    const config = await Config.get()
    if (config.memory?.enabled === false) return []

    const limit = config.memory?.maxMemories ?? 10
    const memories = await Memory.relevant({ projectID: input.projectID, limit })
    if (memories.length === 0) return []

    await Memory.touch(memories.map((m) => m.id))
    log.info("injecting", { count: memories.length })

    const formatted = memories
      .map((m) => `- [${m.category}] ${m.content}`)
      .join("\n")

    return [
      [
        `<project-memory>`,
        `Automatically recalled from previous sessions. Use as context; verify if uncertain.`,
        ``,
        formatted,
        `</project-memory>`,
      ].join("\n"),
    ]
  }
}
