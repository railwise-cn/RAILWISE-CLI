import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import path from "path"
import z from "zod"
import { Instance } from "../../project/instance"
import { Glob } from "../../util/glob"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const Category = z.enum(["report", "bid", "data", "ppt"])
const Variable = z
  .object({
    key: z.string(),
    label: z.string(),
    type: z.enum(["text", "number", "date", "select", "mileage"]),
    placeholder: z.string().optional(),
    required: z.boolean().default(true).optional(),
    options: z.array(z.string()).optional(),
  })
  .meta({ ref: "RailwiseTemplateVariable" })

export const Template = z
  .object({
    id: z.string(),
    name: z.string(),
    category: Category,
    description: z.string(),
    agent: z.string(),
    prompt: z.string(),
    variables: z.array(Variable).default([]).optional(),
    version: z.string().default("1").optional(),
    filePath: z.string().optional(),
    updatedAt: z.number().optional(),
  })
  .meta({ ref: "RailwiseTemplate" })
export type Template = z.infer<typeof Template>

function dir() {
  return path.join(Instance.worktree, ".railwise", "templates")
}

async function read(source: string): Promise<Template> {
  const stat = await Bun.file(source).stat()
  return Template.parse({
    ...(await Bun.file(source).json()),
    filePath: source,
    updatedAt: stat.mtime.getTime(),
  })
}

async function list() {
  const root = dir()
  const files = await Glob.scan("*.json", { cwd: root, absolute: true }).catch(() => [])
  return Promise.all(
    files
      .filter((source) => path.basename(source) !== "schema.json")
      .toSorted()
      .map(read),
  )
}

export const TemplateRoutes = lazy(() =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "业务模板列表",
        description: "Reads .railwise/templates/*.json from the active project on each request.",
        operationId: "templates.list",
        responses: {
          200: {
            description: "Railwise business templates",
            content: {
              "application/json": {
                schema: resolver(Template.array()),
              },
            },
          },
          ...errors(500),
        },
      }),
      async (c) => c.json(await list()),
    )
    .get(
      "/:id",
      describeRoute({
        summary: "业务模板详情",
        operationId: "templates.get",
        responses: {
          200: {
            description: "Railwise business template",
            content: {
              "application/json": {
                schema: resolver(Template),
              },
            },
          },
          ...errors(404, 500),
        },
      }),
      validator("param", z.object({ id: z.string() })),
      async (c) => {
        const template = (await list()).find((item) => item.id === c.req.valid("param").id)
        if (!template) return c.json({ error: "template not found" }, 404)
        return c.json(template)
      },
    ),
)
