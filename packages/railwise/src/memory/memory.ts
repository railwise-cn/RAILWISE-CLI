import z from "zod"
import { fn } from "@/util/fn"
import { Log } from "@/util/log"
import { Database, eq, and, isNull, desc, inArray, sql } from "@/storage/db"
import { MemoryTable } from "./memory.sql"
import { Identifier } from "@/id/id"
import { Instance } from "@/project/instance"

export namespace Memory {
  const log = Log.create({ service: "memory" })

  export const Category = z.enum(["discovery", "decision", "pattern", "preference", "error", "fact"])
  export type Category = z.infer<typeof Category>

  export const Info = z.object({
    id: z.string(),
    projectID: z.string(),
    sessionID: z.string().optional(),
    category: Category,
    content: z.string(),
    source: z.string().optional(),
    confidence: z.number(),
    accessCount: z.number(),
    time: z.object({
      created: z.number(),
      updated: z.number(),
      accessed: z.number().optional(),
      expired: z.number().optional(),
    }),
  })
  export type Info = z.infer<typeof Info>

  function fromRow(row: typeof MemoryTable.$inferSelect): Info {
    return {
      id: row.id,
      projectID: row.project_id,
      sessionID: row.session_id ?? undefined,
      category: row.category as Category,
      content: row.content,
      source: row.source ?? undefined,
      confidence: row.confidence,
      accessCount: row.access_count,
      time: {
        created: row.time_created,
        updated: row.time_updated,
        accessed: row.time_accessed ?? undefined,
        expired: row.time_expired ?? undefined,
      },
    }
  }

  export const add = fn(
    z.object({
      projectID: z.string(),
      sessionID: z.string().optional(),
      category: Category,
      content: z.string(),
      source: z.string().optional(),
      confidence: z.number().default(1.0),
    }),
    async (input) => {
      const id = Identifier.ascending("memory")
      const now = Date.now()
      Database.use((db) =>
        db
          .insert(MemoryTable)
          .values({
            id,
            project_id: input.projectID,
            session_id: input.sessionID,
            category: input.category,
            content: input.content,
            source: input.source,
            confidence: input.confidence,
            access_count: 0,
            time_created: now,
            time_updated: now,
          })
          .run(),
      )
      log.info("added", { id, category: input.category })
      return id
    },
  )

  export const remove = fn(z.string(), async (id) => {
    Database.use((db) => db.delete(MemoryTable).where(eq(MemoryTable.id, id)).run())
    log.info("removed", { id })
  })

  export const list = fn(
    z.object({
      projectID: z.string(),
      category: Category.optional(),
      limit: z.number().default(50),
    }),
    async (input) => {
      const conditions = [eq(MemoryTable.project_id, input.projectID), isNull(MemoryTable.time_expired)]
      if (input.category) conditions.push(eq(MemoryTable.category, input.category))
      const rows = Database.use((db) =>
        db
          .select()
          .from(MemoryTable)
          .where(and(...conditions))
          .orderBy(desc(MemoryTable.confidence))
          .limit(input.limit)
          .all(),
      )
      return rows.map(fromRow)
    },
  )

  export const relevant = fn(
    z.object({
      projectID: z.string(),
      limit: z.number().default(10),
    }),
    async (input) => {
      const rows = Database.use((db) =>
        db
          .select()
          .from(MemoryTable)
          .where(and(eq(MemoryTable.project_id, input.projectID), isNull(MemoryTable.time_expired)))
          .orderBy(desc(MemoryTable.confidence))
          .limit(input.limit)
          .all(),
      )
      return rows.map(fromRow)
    },
  )

  export const touch = fn(z.array(z.string()), async (ids) => {
    if (ids.length === 0) return
    const now = Date.now()
    Database.use((db) => {
      for (const id of ids) {
        db.update(MemoryTable)
          .set({
            access_count: sql`${MemoryTable.access_count} + 1`,
            time_accessed: now,
            time_updated: now,
          })
          .where(eq(MemoryTable.id, id))
          .run()
      }
    })
  })

  export const boost = fn(
    z.object({
      id: z.string(),
      delta: z.number().default(0.1),
    }),
    async (input) => {
      const row = Database.use((db) => db.select().from(MemoryTable).where(eq(MemoryTable.id, input.id)).get())
      if (!row) return
      const next = Math.min(1.0, row.confidence + input.delta)
      Database.use((db) =>
        db
          .update(MemoryTable)
          .set({ confidence: next, time_updated: Date.now() })
          .where(eq(MemoryTable.id, input.id))
          .run(),
      )
    },
  )

  export const expire = fn(z.string(), async (id) => {
    Database.use((db) =>
      db
        .update(MemoryTable)
        .set({ time_expired: Date.now() })
        .where(eq(MemoryTable.id, id))
        .run(),
    )
    log.info("expired", { id })
  })

  export const clear = fn(z.string(), async (projectID) => {
    Database.use((db) => db.delete(MemoryTable).where(eq(MemoryTable.project_id, projectID)).run())
    log.info("cleared", { projectID })
  })

  export function count(projectID: string) {
    const rows = Database.use((db) =>
      db
        .select()
        .from(MemoryTable)
        .where(and(eq(MemoryTable.project_id, projectID), isNull(MemoryTable.time_expired)))
        .all(),
    )
    return rows.length
  }
}
