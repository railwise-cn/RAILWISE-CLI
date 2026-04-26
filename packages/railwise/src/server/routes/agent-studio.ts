import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import matter from "gray-matter"
import path from "path"
import { mkdir } from "fs/promises"
import z from "zod"
import { Agent } from "../../agent/agent"
import { AgentUpdated } from "../../agent/agent-events"
import presets from "../../agent/workflow-presets.json" with { type: "json" }
import { Bus } from "../../bus"
import { Identifier } from "../../id/id"
import { Instance } from "../../project/instance"
import { Session } from "../../session"
import { MessageTable } from "../../session/session.sql"
import { Database, gte } from "../../storage/db"
import { lazy } from "../../util/lazy"
import { errors } from "../error"

const AgentName = z.string().regex(/^[A-Za-z0-9_-]+$/)

const WorkflowNodeSchema = z
  .object({
    id: z.string(),
    agent: z.string(),
    label: z.string(),
    color: z.string(),
    x: z.number(),
    y: z.number(),
  })
  .meta({ ref: "WorkflowNode" })

const WorkflowEdgeSchema = z
  .object({
    from: z.string(),
    to: z.string(),
    kind: z.enum(["serial", "parallel", "optional"]),
    label: z.string().optional(),
  })
  .meta({ ref: "WorkflowEdge" })

const WorkflowSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    nodes: z.array(WorkflowNodeSchema),
    edges: z.array(WorkflowEdgeSchema),
  })
  .meta({ ref: "WorkflowPreset" })

const AgentListItemSchema = Agent.Info.extend({
  filePath: z.string().optional().meta({
    description: "Absolute path of the backing .md file.",
  }),
  callCount7d: z.number().int().optional().meta({
    description: "Message count by this agent in the last 7 days.",
  }),
}).meta({ ref: "AgentListItem" })

const AgentDetailSchema = Agent.Info.extend({
  filePath: z.string().optional(),
  rawMarkdown: z.string().meta({
    description: "Full markdown source including frontmatter.",
  }),
}).meta({ ref: "AgentDetail" })

const WorkflowRunSchema = z
  .object({
    sessionId: z.string(),
    sessionTitle: z.string(),
    workflowId: z.string(),
    agentNames: z.string().array(),
  })
  .meta({ ref: "WorkflowRun" })

function file(name: string) {
  return path.join(Instance.worktree, ".railwise", "agent", `${name}.md`)
}

function model(agent: Agent.Info) {
  if (!agent.model) return undefined
  return `${agent.model.providerID}/${agent.model.modelID}`
}

function frontmatter(agent: Agent.Info) {
  return Object.fromEntries(
    Object.entries({
      description: agent.description,
      mode: agent.mode,
      model: model(agent),
      color: agent.color,
      temperature: agent.temperature,
      top_p: agent.topP,
      steps: agent.steps,
    }).filter((entry): entry is [string, string | number] => entry[1] !== undefined),
  )
}

async function read(name: string, agent: Agent.Info) {
  const source = file(name)
  const disk = Bun.file(source)
  if (await disk.exists()) return { filePath: source, rawMarkdown: await disk.text() }
  return {
    filePath: undefined,
    rawMarkdown: matter.stringify(agent.prompt ?? "", frontmatter(agent)),
  }
}

async function write(name: string, content: string) {
  const source = file(name)
  await mkdir(path.dirname(source), { recursive: true })
  await Bun.write(source, content)
}

function calls() {
  const rows = Database.use((db) =>
    db
      .select({ data: MessageTable.data })
      .from(MessageTable)
      .where(gte(MessageTable.time_created, Date.now() - 7 * 24 * 60 * 60 * 1000))
      .all(),
  )
  return rows.reduce((acc, row) => acc.set(row.data.agent, (acc.get(row.data.agent) ?? 0) + 1), new Map<string, number>())
}

function prompt(workflow: (typeof presets)[number], input?: Record<string, unknown>) {
  const nodes = workflow.nodes.map((node, index) => `${index + 1}. ${node.label} (@${node.agent})`).join("\n")
  const edges = workflow.edges.map((edge) => `${edge.from} -> ${edge.to}: ${edge.label ?? edge.kind}`).join("\n")
  const payload = input && Object.keys(input).length > 0 ? `\n\n输入参数：\n${JSON.stringify(input, null, 2)}` : ""
  return [
    `请按「${workflow.name}」执行工程测绘工作流。`,
    workflow.description,
    `节点：\n${nodes}`,
    `依赖关系：\n${edges}`,
    "请先输出 WBS、并行/串行关系、质量闸门和预期成果，再按节点推进。",
  ].join("\n\n") + payload
}

async function seed(workflow: (typeof presets)[number], sessionId: string, input?: Record<string, unknown>) {
  const agentName = workflow.nodes.find((node) => node.agent === "chief_manager")?.agent ?? workflow.nodes[0]?.agent ?? "build"
  const agent = await Agent.get(agentName)
  const messageId = Identifier.ascending("message")
  await Session.updateMessage({
    id: messageId,
    sessionID: sessionId,
    role: "user",
    time: { created: Date.now() },
    agent: agentName,
    model: agent?.model ?? { providerID: "railwise", modelID: "workflow" },
  })
  await Session.updatePart({
    id: Identifier.ascending("part"),
    sessionID: sessionId,
    messageID: messageId,
    type: "text",
    text: prompt(workflow, input),
    synthetic: true,
  })
}

export const AgentStudioRoutes = lazy(() =>
  new Hono()
    .get(
      "/list",
      describeRoute({
        summary: "List all agents",
        description: "Returns visible Agent.Info entries with backing file paths and recent call counts.",
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
        const count = calls()
        const items = await Promise.all(
          agents
            .filter((agent) => !agent.hidden)
            .map(async (agent) => {
              const source = file(agent.name)
              return {
                ...agent,
                filePath: (await Bun.file(source).exists()) ? source : undefined,
                callCount7d: count.get(agent.name) ?? 0,
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
      (c) => c.json(presets),
    )
    .get(
      "/:name",
      describeRoute({
        summary: "Get agent detail",
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
      validator("param", z.object({ name: AgentName })),
      async (c) => {
        const { name } = c.req.valid("param")
        const agent = await Agent.get(name)
        if (!agent) return c.json({ error: `agent "${name}" not found` }, 404)
        return c.json({
          ...agent,
          ...(await read(name, agent)),
        })
      },
    )
    .put(
      "/:name",
      describeRoute({
        summary: "Update agent markdown",
        description: "Writes .railwise/agent/:name.md and publishes agent.updated for hot refresh.",
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
      validator("param", z.object({ name: AgentName })),
      validator(
        "json",
        z.object({
          rawMarkdown: z.string().min(1),
        }),
      ),
      async (c) => {
        const { name } = c.req.valid("param")
        const agent = await Agent.get(name)
        if (!agent) return c.json({ error: `agent "${name}" not found` }, 404)
        await write(name, c.req.valid("json").rawMarkdown)
        await Instance.dispose()
        await Bus.publish(AgentUpdated, { name })
        return c.json(true)
      },
    )
    .post(
      "/workflow/run",
      describeRoute({
        summary: "Trigger workflow run",
        description: "Creates a real session seeded with the selected workflow plan for chief_manager dispatch.",
        operationId: "agentStudio.workflow.run",
        responses: {
          200: {
            description: "Workflow accepted",
            content: {
              "application/json": {
                schema: resolver(WorkflowRunSchema),
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
          input: z.record(z.string(), z.unknown()).optional(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const workflow = presets.find((item) => item.id === body.workflowId)
        if (!workflow) return c.json({ error: `workflow "${body.workflowId}" not found` }, 400)
        const title = `工作流：${workflow.name}`
        const session = await Session.create({ title })
        await seed(workflow, session.id, body.input)
        return c.json({
          sessionId: session.id,
          sessionTitle: title,
          workflowId: workflow.id,
          agentNames: [...new Set(workflow.nodes.map((node) => node.agent))],
        })
      },
    ),
)
