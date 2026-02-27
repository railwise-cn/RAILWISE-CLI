import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export const MemoryTable = sqliteTable(
  "memory",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    category: text().notNull(),
    content: text().notNull(),
    source: text(),
    confidence: real().notNull().default(1.0),
    access_count: integer().notNull().default(0),
    ...Timestamps,
    time_accessed: integer(),
    time_expired: integer(),
  },
  (table) => [
    index("memory_project_idx").on(table.project_id),
    index("memory_category_idx").on(table.category),
    index("memory_confidence_idx").on(table.confidence),
  ],
)
