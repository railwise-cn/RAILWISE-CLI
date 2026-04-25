import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import path from "path"
import { Agent } from "../../agent/agent"
import { Bus } from "../../bus"
import { AgentUpdated } from "../../agent/agent-events"
import { Instance } from "../../project/instance"
import { errors } from "../error"
import { lazy } from "../../util/lazy"
import presets from "../../agent/workflow-presets.json" with { type: "json" }

function agentFilePath(name: string) {
  return path.join(Instance.worktree, ".railwise", "agent", `${name}.md`)
}

async function readAgentFile(name: string) {
  const file = Bun.file(agentFilePath(name))
  if (!(await file.exists())) return undefined
  return file.text()
}

async function writeAgentFile(name: string, content: string) {
  await Bun.write(agentFilePath(name), content)
}

const AgentListItemSchema = Agent.Info.extend({
  filePath: z.string().optional().meta({
    description: "Absolute path of the backing .md file (undefined for built-in/native agents without overrides).",
  }),
  callCount7d: z.number().int().optional().meta({
    description: "Calls over the last 7 days. Reserved for M3; currently always 0.",
  }),
}).meta({ ref: "AgentListItem" })

const AgentDetailSchema = Agent.Info.extend({
  filePath: z.string().optional(),
  rawMarkdown: z.string().optional().meta({
    description: "Full Markdown source including frontmatter.",
  }),
}).meta({ ref: "AgentDetail" })

const WorkflowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    nodes: z.array(z.any()),
    edges: z.array(z.any()),
  })
  .meta({ ref: "WorkflowPreset" })

export const AgentStudioRoutes = lazy(() =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List all agents",
        description: "Returns Agent.Info[] augmented with backing file path and recent call count.",
        operationId: "agentStudio.list",
        responses: {
          200: {
            description: "Agent list",
            content: {
              "application/json": {
                schema: resolver(AgentListItemSchema.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const agents = await Agent.list()
        const items = await Promise.all(
          agents
            .filter((a) => !a.hidden)
            .map(async (agent) => {
              const fp = agentFilePath(agent.name)
              const exists = await Bun.file(fp).exists()
              return {
                ...agent,
                filePath: exists ? fp : undefined,
                callCount7d: 0,
              }
            }),
        )
        return c.json(items)
      },
    )
    .get(
      "/workflow/presets",
      describeRoute({
        summary: "List built-in workflow presets",
        operationId: "agentStudio.workflow.presets",
        responses: {
          200: {
            description: "Workflow preset array",
            content: {
              "application/json": {
                schema: resolver(WorkflowSchema.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json(presets),
    )
    .get(
      "/:name",
      describeRoute({
        summary: "Get agent detail (with raw markdown)",
        operationId: "agentStudio.get",
        responses: {
          200: {
            description: "Agent detail",
            content: {
              "application/json": { schema: resolver(AgentDetailSchema) },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ name: z.string() })),
      async (c) => {
        const { name } = c.req.valid("param")
        const agent = await Agent.get(name)
        if (!agent) return c.json({ error: `agent "${name}" not found` }, 404)
        const fp = agentFilePath(name)
        const rawMarkdown = await readAgentFile(name)
        return c.json({
          ...agent,
          filePath: rawMarkdown ? fp : undefined,
          rawMarkdown,
        })
      },
    )
    .put(
      "/:name",
      describeRoute({
        summary: "Update agent prompt + frontmatter",
        description:
          "Writes the full markdown (including frontmatter) back to .railwise/agent/:name.md and publishes agent.updated.",
        operationId: "agentStudio.update",
        responses: {
          200: {
            description: "Write succeeded",
            content: {
              "application/json": { schema: resolver(z.boolean()) },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator("param", z.object({ name: z.string() })),
      validator(
        "json",
        z.object({
          rawMarkdown: z.string().min(1).meta({
            description: "Full markdown source including frontmatter.",
          }),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        const { rawMarkdown } = c.req.valid("json")
        const agent = await Agent.get(name)
        if (!agent) return c.json({ error: `agent "${name}" not found` }, 404)
        await writeAgentFile(name, rawMarkdown)
        await Bus.publish(AgentUpdated, { name })
        return c.json(true)
      },
    )
    .post(
      "/workflow/run",
      describeRoute({
        summary: "Trigger a workflow run",
        description:
          "Stub: returns a placeholder sessionId. Full chief_manager dispatch lands in M3.",
        operationId: "agentStudio.workflow.run",
        responses: {
          200: {
            description: "Workflow accepted",
            content: {
              "application/json": {
                schema: resolver(z.object({ sessionId: z.string() })),
              },
            },
          },
          ...errors(400),
        },
      }),
      validator(
        "json",
        z.object({
          workflowId: z.string(),
          input: z.record(z.string(), z.any()).optional(),
        }),
      ),
      async (c) => {
        const { workflowId } = c.req.valid("json")
        const sessionId = `workflow-${workflowId}-${Date.now()}`
        return c.json({ sessionId })
      },
    ),
)
