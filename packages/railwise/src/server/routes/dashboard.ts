import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { ProjectMeta } from "../../project/project-meta"
import { Session } from "../../session"
import { SessionStatus } from "../../session/status"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

export const ProjectTypeSchema = z.enum(["metro", "excavation", "bridge", "slope", "highrise"])
export type ProjectType = z.infer<typeof ProjectTypeSchema>

export const PROJECT_TYPE_LABEL: Record<ProjectType, string> = {
  metro: "地铁区间",
  excavation: "基坑",
  bridge: "桥梁",
  slope: "边坡",
  highrise: "高层建筑",
}

export const ProjectCardSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    type: ProjectTypeSchema,
    status: z.enum(["active", "completed", "paused", "error"]),
    progress: z.number().min(0).max(100),
    lastActivity: z.string().datetime(),
    activeTaskCount: z.number().int().nonnegative(),
    description: z.string().optional(),
    pointCount: z.number().int().nonnegative(),
    alertCount: z.number().int().nonnegative(),
    bboxJson: z.string().optional(),
  })
  .meta({ ref: "DashboardProjectCard" })
export type ProjectCard = z.infer<typeof ProjectCardSchema>

export const AlertSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    pointId: z.string().optional(),
    level: z.enum(["warn", "error"]),
    message: z.string(),
    time: z.string().datetime(),
  })
  .meta({ ref: "DashboardAlert" })
export type Alert = z.infer<typeof AlertSchema>

export const SessionBriefSchema = z
  .object({
    id: z.string(),
    directory: z.string(),
    title: z.string(),
    time: z.object({ updated: z.number() }),
  })
  .meta({ ref: "DashboardSessionBrief" })
export type SessionBrief = z.infer<typeof SessionBriefSchema>

export const ActiveAgentSchema = z
  .object({
    sessionId: z.string(),
    agentName: z.string(),
    startedAt: z.string().datetime(),
    status: z.enum(["running", "waiting", "error"]),
  })
  .meta({ ref: "DashboardActiveAgent" })
export type ActiveAgent = z.infer<typeof ActiveAgentSchema>

export const DashboardSummarySchema = z
  .object({
    projects: ProjectCardSchema.array(),
    alerts: AlertSchema.array(),
    recentSessions: SessionBriefSchema.array(),
    activeAgents: ActiveAgentSchema.array(),
  })
  .meta({ ref: "DashboardSummary" })
export type DashboardSummary = z.infer<typeof DashboardSummarySchema>

const GeoJSONSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.unknown().array(),
})

function sessions(limit: number): SessionBrief[] {
  return Array.from(Session.list({ roots: true, limit })).map((session) => ({
    id: session.id,
    directory: session.directory,
    title: session.title,
    time: { updated: session.time.updated },
  }))
}

function agents(): ActiveAgent[] {
  return Object.entries(SessionStatus.list()).map(([sessionId, status]) => ({
    sessionId,
    agentName: "chief_manager",
    startedAt: new Date().toISOString(),
    status: status.type === "retry" ? "waiting" : "running",
  }))
}

export const DashboardRoutes = lazy(() =>
  new Hono()
    .get(
      "/summary",
      describeRoute({
        summary: "仪表板摘要",
        operationId: "dashboard.summary",
        responses: {
          200: {
            description: "Dashboard summary",
            content: {
              "application/json": {
                schema: resolver(DashboardSummarySchema),
              },
            },
          },
          ...errors(500),
        },
      }),
      async (c) =>
        c.json({
          projects: await ProjectMeta.listCards(),
          alerts: await ProjectMeta.listAlerts(),
          recentSessions: sessions(10),
          activeAgents: agents(),
        } satisfies z.infer<typeof DashboardSummarySchema>),
    )
    .get(
      "/projects",
      describeRoute({
        summary: "项目列表（含 bbox）",
        operationId: "dashboard.projects",
        responses: {
          200: {
            description: "ProjectCard[]",
            content: {
              "application/json": {
                schema: resolver(ProjectCardSchema.array()),
              },
            },
          },
          ...errors(500),
        },
      }),
      async (c) => c.json(await ProjectMeta.listCards()),
    )
    .get(
      "/projects/:id/points",
      describeRoute({
        summary: "监测点 GeoJSON",
        operationId: "dashboard.project.points",
        responses: {
          200: {
            description: "GeoJSON FeatureCollection",
            content: {
              "application/json": {
                schema: resolver(GeoJSONSchema),
              },
            },
          },
          ...errors(404, 500),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => c.json(await ProjectMeta.getPointsGeoJSON(c.req.valid("param").id)),
    )
    .get(
      "/projects/:id/timeseries",
      describeRoute({
        summary: "时序数据（uPlot 格式）",
        operationId: "dashboard.project.timeseries",
        responses: {
          200: {
            description: "[[timestamps], [values]]",
            content: {
              "application/json": {
                schema: resolver(z.array(z.array(z.number()))),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      validator(
        "query",
        z.object({
          metric: z.enum(["settlement", "displacement"]).default("settlement"),
          days: z.coerce.number().int().min(1).max(365).default(30),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query")
        return c.json(await ProjectMeta.getTimeseries(c.req.valid("param").id, query.metric, query.days))
      },
    ),
)
