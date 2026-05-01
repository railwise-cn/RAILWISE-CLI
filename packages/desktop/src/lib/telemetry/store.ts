import Database from "@tauri-apps/plugin-sql"
import type { TelemetryEvent } from "./index"

export type StoredTelemetryEvent = TelemetryEvent & {
  id: string
}

type Db = Awaited<ReturnType<typeof Database.load>>
type Row = {
  id: string
  event: string
  properties: string
  ts: number
}
type State = {
  value: number
}

const NAME = "sqlite:railwise.telemetry.db"
const ENABLED = "enabled"
const MAX_EVENTS = 500

let pending: Promise<Db | null> | undefined
const memory = {
  enabled: false,
  events: [] as StoredTelemetryEvent[],
}

function id() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

async function db(): Promise<Db | null> {
  pending ??= Database.load(NAME)
    .then(async (sql) => {
      await sql.execute(
        "CREATE TABLE IF NOT EXISTS telemetry_events (id TEXT PRIMARY KEY, event TEXT NOT NULL, properties TEXT NOT NULL, ts INTEGER NOT NULL)",
      )
      await sql.execute("CREATE INDEX IF NOT EXISTS telemetry_events_ts ON telemetry_events (ts)")
      await sql.execute("CREATE TABLE IF NOT EXISTS telemetry_state (name TEXT PRIMARY KEY, value INTEGER NOT NULL)")
      return sql
    })
    .catch(() => null)
  return pending
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function event(row: Row): StoredTelemetryEvent {
  const properties = JSON.parse(row.properties) as unknown
  return {
    id: row.id,
    event: row.event,
    properties: record(properties) ? properties : {},
    ts: row.ts,
  }
}

async function read() {
  const sql = await db()
  if (!sql) return memory.events
  return (
    await sql.select<Row[]>("SELECT id, event, properties, ts FROM telemetry_events ORDER BY ts ASC LIMIT ?", [
      MAX_EVENTS,
    ])
  ).map(event)
}

export async function isEnabled() {
  const sql = await db()
  if (!sql) return memory.enabled
  const rows = await sql.select<State[]>("SELECT value FROM telemetry_state WHERE name = ?", [ENABLED]).catch(() => [])
  return rows[0]?.value === 1
}

export async function setEnabled(value: boolean) {
  memory.enabled = value
  const sql = await db()
  await sql
    ?.execute("INSERT INTO telemetry_state (name, value) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET value = ?", [
      ENABLED,
      value ? 1 : 0,
      value ? 1 : 0,
    ])
    .catch(() => undefined)
  if (!value) await clear()
}

export async function insert(event: TelemetryEvent) {
  if (!(await isEnabled())) return
  const next = { ...event, id: id() }
  const sql = await db()
  if (!sql) {
    memory.events = [...memory.events, next].slice(-MAX_EVENTS)
    return
  }

  await sql.execute("INSERT OR REPLACE INTO telemetry_events (id, event, properties, ts) VALUES (?, ?, ?, ?)", [
    next.id,
    next.event,
    JSON.stringify(next.properties),
    next.ts,
  ])
  await sql.execute(
    "DELETE FROM telemetry_events WHERE id NOT IN (SELECT id FROM telemetry_events ORDER BY ts DESC LIMIT ?)",
    [MAX_EVENTS],
  )
}

export async function take(limit = 100) {
  return (await read()).slice(0, limit)
}

export async function drop(ids: string[]) {
  if (ids.length === 0) return
  const sql = await db()
  if (!sql) {
    const set = new Set(ids)
    memory.events = memory.events.filter((event) => !set.has(event.id))
    return
  }
  await sql.execute(`DELETE FROM telemetry_events WHERE id IN (${ids.map(() => "?").join(", ")})`, ids)
}

export async function clear() {
  memory.events = []
  await (await db())?.execute("DELETE FROM telemetry_events").catch(() => undefined)
}
