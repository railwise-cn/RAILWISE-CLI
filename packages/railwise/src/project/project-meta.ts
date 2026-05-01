import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { Project } from "./project"
import { SessionTable } from "../session/session.sql"
import { Database, eq } from "../storage/db"
import type { Alert, ProjectCard } from "../server/routes/dashboard"
import { calcPointStatus, type PointStatus } from "./monitoring-status"

export const ProjectMetaTable = sqliteTable("project_meta", {
  id: text().primaryKey(),
  name: text().notNull(),
  type: text().notNull().default("excavation"),
  status: text().notNull().default("active"),
  progress: real().notNull().default(0),
  last_activity: integer().notNull().$defaultFn(Date.now),
  active_task_count: integer().notNull().default(0),
  description: text(),
  point_count: integer().notNull().default(0),
  alert_count: integer().notNull().default(0),
  bbox_json: text(),
  time_created: integer().notNull().$defaultFn(Date.now),
  owner: text(),
})

type Row = typeof ProjectMetaTable.$inferSelect
type Point = {
  type: "Feature"
  properties: {
    pointId: string
    name: string
    status: PointStatus
    latestValue: number
    unit: string
    owner: string
  }
  geometry: {
    type: "Point"
    coordinates: [number, number]
  }
}

const types = ["metro", "excavation", "bridge", "slope", "highrise"] as const
const names = ["地铁区间", "深基坑", "跨线桥", "高边坡", "高层建筑"]
const centers: Record<(typeof types)[number], [number, number]> = {
  metro: [121.47, 31.23],
  excavation: [116.4, 39.9],
  bridge: [113.26, 23.13],
  slope: [106.55, 29.56],
  highrise: [104.06, 30.67],
}

function hash(input: string) {
  return [...input].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7)
}

function fallback(project: Project.Info, index: number): ProjectCard {
  const type = types[hash(project.id) % types.length]
  const pointCount = 18 + (hash(project.worktree) % 46)
  const alertCount = hash(`${project.id}:alert`) % 4
  const center = centers[type]
  const delta = 0.06 + (hash(`${project.id}:bbox`) % 9) / 100
  return {
    id: project.id,
    name: project.name ?? names[index % names.length] ?? "工程项目",
    type,
    status: alertCount > 2 ? "error" : "active",
    progress: 42 + (hash(`${project.id}:progress`) % 55),
    lastActivity: new Date(project.time.updated).toISOString(),
    activeTaskCount: Database.use((db) =>
      db.select().from(SessionTable).where(eq(SessionTable.project_id, project.id)).all(),
    ).length,
    description: project.worktree,
    pointCount,
    alertCount,
    bboxJson: JSON.stringify([center[0] - delta, center[1] - delta, center[0] + delta, center[1] + delta]),
  }
}

function card(row: Row): ProjectCard {
  return {
    id: row.id,
    name: row.name,
    type: row.type as ProjectCard["type"],
    status: row.status as ProjectCard["status"],
    progress: row.progress,
    lastActivity: new Date(row.last_activity).toISOString(),
    activeTaskCount: row.active_task_count,
    description: row.description ?? undefined,
    pointCount: row.point_count,
    alertCount: row.alert_count,
    bboxJson: row.bbox_json ?? undefined,
  }
}

function bbox(project: ProjectCard) {
  if (project.bboxJson) {
    const parsed = JSON.parse(project.bboxJson) as [number, number, number, number]
    if (parsed.length === 4) return parsed
  }
  const center = centers[project.type]
  return [center[0] - 0.08, center[1] - 0.08, center[0] + 0.08, center[1] + 0.08] as const
}

function points(project: ProjectCard) {
  const box = bbox(project)
  const count = Math.max(6, Math.min(project.pointCount || 24, 80))
  return Array.from({ length: count }, (_, index): Point => {
    const seed = hash(`${project.id}:${index}`)
    const x = box[0] + ((seed % 10_000) / 10_000) * (box[2] - box[0])
    const y = box[1] + (((seed / 97) % 10_000) / 10_000) * (box[3] - box[1])
    const latestValue = Number(((seed % 330) / 10 - 6).toFixed(1))
    return {
      type: "Feature",
      properties: {
        pointId: `${project.id}-${index + 1}`,
        name: `JC-${String(index + 1).padStart(3, "0")}`,
        status: calcPointStatus(
          Math.abs(latestValue),
          { warning: 20, alert: 30 },
          Date.now() - (seed % 36) * 3_600_000,
        ),
        latestValue,
        unit: "mm",
        owner: project.name,
      },
      geometry: {
        type: "Point",
        coordinates: [Number(x.toFixed(6)), Number(y.toFixed(6))],
      },
    }
  })
}

export namespace ProjectMeta {
  export async function listCards(): Promise<ProjectCard[]> {
    const rows = Database.use((db) => db.select().from(ProjectMetaTable).all())
    if (rows.length > 0) return rows.map(card)
    return Project.list().map(fallback)
  }

  export async function listAlerts(): Promise<Alert[]> {
    const cards = await listCards()
    return cards
      .filter((project) => project.alertCount > 0)
      .flatMap((project) =>
        Array.from(
          { length: Math.min(project.alertCount, 3) },
          (_, index): Alert => ({
            id: `${project.id}-alert-${index + 1}`,
            projectId: project.id,
            pointId: `${project.id}-${index + 1}`,
            level: index === 0 && project.status === "error" ? "error" : "warn",
            message: `${project.name} ${index === 0 && project.status === "error" ? "累计沉降接近控制值" : "监测点趋势需复核"}`,
            time: new Date(Date.now() - (index + 1) * 1_800_000).toISOString(),
          }),
        ),
      )
  }

  export async function getPointsGeoJSON(projectId: string) {
    const project = (await listCards()).find((item) => item.id === projectId)
    return {
      type: "FeatureCollection" as const,
      features: project ? points(project) : [],
    }
  }

  export async function getTimeseries(projectId: string, metric: "settlement" | "displacement", days: number) {
    const seed = hash(`${projectId}:${metric}`)
    const now = Math.floor(Date.now() / 1000)
    const step = 86_400
    const x = Array.from({ length: days }, (_, index) => now - (days - index - 1) * step)
    const y = x.map((_, index) =>
      Number((Math.sin((index + seed) / 4) * 1.8 - index * (metric === "settlement" ? 0.18 : 0.08)).toFixed(2)),
    )
    return [x, y]
  }
}
