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
import { Skill } from "../../skill"
import { Database, gte } from "../../storage/db"
import { ToolRegistry } from "../../tool/registry"
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
  displayName: z.string().optional().meta({
    description: "Localized product-facing name for RailWISE capability settings.",
  }),
  filePath: z.string().optional().meta({
    description: "Absolute path of the backing .md file.",
  }),
  callCount7d: z.number().int().optional().meta({
    description: "Message count by this agent in the last 7 days.",
  }),
}).meta({ ref: "AgentListItem" })

const AgentDetailSchema = Agent.Info.extend({
  displayName: z.string().optional(),
  filePath: z.string().optional(),
  rawMarkdown: z.string().meta({
    description: "Full markdown source including frontmatter.",
  }),
}).meta({ ref: "AgentDetail" })

const ToolInventorySchema = z
  .object({
    id: z.string(),
    label: z.string(),
    group: z.enum(["agent", "knowledge", "survey", "core", "extension"]),
  })
  .meta({ ref: "ToolInventoryItem" })

const SkillInventorySchema = z
  .object({
    name: z.string(),
    description: z.string(),
    location: z.string(),
  })
  .meta({ ref: "SkillInventoryItem" })

const WorkflowRunSchema = z
  .object({
    sessionId: z.string(),
    sessionTitle: z.string(),
    workflowId: z.string(),
    agentNames: z.string().array(),
  })
  .meta({ ref: "WorkflowRun" })

const labels: Record<string, string> = {
  task: "协作智能体调度",
  skill: "Skill 加载器",
  tool_wiki_query: "规范 Wiki 查询",
  tool_wiki_ingest: "规范资料入库",
  tool_wiki_index: "规范索引重建",
  tool_wiki_lint: "规范库质检",
  tool_norm_search: "规范条文检索",
  tool_norm_diff: "规范版本对比",
  tool_norm_cite: "规范引用固化",
  tool_format_converter: "测量格式转换",
  tool_adjustment_indirect: "间接平差",
  tool_adjustment_free_network: "自由网平差",
  tool_adjustment_robust: "稳健平差",
  tool_variance_component: "方差分量估计",
  tool_adjustment_condition: "条件平差",
  tool_gross_error_detection: "粗差探测",
  angle_convert_angle_convert: "角度格式转换",
  angle_convert_decimal_to_dms: "十进制度转度分秒",
  angle_convert_dms_to_decimal: "度分秒转十进制度",
  axial_force_axial_force_calc: "支撑轴力换算",
  axial_force_axial_force_comparison: "轴力多期对比",
  chart_generator: "监测趋势图生成",
  control_network_network_design: "控制网布设设计",
  control_network_plane_network_adjustment: "平面控制网平差",
  coord_transform_datum_transform: "坐标基准转换",
  coord_transform_gauss_forward: "高斯正算",
  coord_transform_gauss_inverse: "高斯反算",
  cpiii_adjustment_cpiii_network_adjustment: "CPIII 控制网平差",
  cpiii_adjustment_free_station_resection: "自由设站后方交会",
  cross_section_clearance_check: "断面限界检查",
  cross_section_convergence_calc: "隧道收敛计算",
  cross_section_profile_comparison: "断面多期对比",
  deformation_rate_deformation_comparison: "变形量多期对比",
  deformation_rate_deformation_rate: "变形速率分析",
  distance_calculator_atmospheric_correction: "气象改正",
  distance_calculator_distance_reduction: "边长归算",
  distance_calculator_projection_correction: "投影改正",
  distance_calculator_slope_to_horizontal: "斜距转平距",
  excel_export_excel_export: "Excel 成果表导出",
  excel_export_monitoring_table_export: "监测数据表导出",
  format_parser: "仪器原始格式解析",
  inclinometer_inclinometer_profile: "测斜剖面分析",
  inclinometer_inclinometer_trend: "测斜趋势分析",
  monitoring_csv: "监测 CSV 清洗分析",
  pile_stakeout_batch_stakeout_points: "放样点批量计算",
  pile_stakeout_chainage_offset: "里程偏距计算",
  pile_stakeout_polar_stakeout: "极坐标放样",
  report_export: "Word 成果报告导出",
  shield_guidance_shield_position: "盾构姿态计算",
  shield_guidance_shield_ring_build: "管片拼装分析",
  shield_guidance_shield_trend: "盾构趋势分析",
  standard_query_list_standards: "规范库清单",
  standard_query_query_standard: "规范条文查询",
  survey_calculator_alert_level: "监测预警分级",
  survey_calculator_leveling_adjustment: "水准网严密平差",
  survey_calculator_leveling_closure: "水准闭合差检核",
  survey_calculator_traverse_adjustment: "导线网严密平差",
  survey_calculator_traverse_closure: "导线闭合差检核",
  water_level_water_level_analysis: "地下水位分析",
  water_level_water_level_contour: "地下水位等值线",
}

type ToolGroup = z.infer<typeof ToolInventorySchema>["group"]

const railwiseAgents = [
  ["chief_manager", "RAILWISE 主控"],
  ["solution_architect", "技术方案架构师"],
  ["qa_inspector", "外业数据首检"],
  ["data_analyst", "测绘数据分析"],
  ["qa_reviewer", "技术复核"],
  ["technical_writer", "工程报告编制"],
  ["commercial_specialist", "商务招投标"],
  ["ppt_master", "汇报材料设计"],
  ["cpiii_specialist", "CPIII 测量专家"],
  ["adjustment_computer", "严密平差计算"],
  ["norm_librarian", "规范资料管理员"],
  ["knowledge_curator", "知识库整理员"],
  ["source_ingestor", "资料入库专员"],
] as const

const railwiseAgentNames = new Map<string, string>(railwiseAgents)

function displayName(agent: Agent.Info) {
  return railwiseAgentNames.get(agent.name)
}

function business(agent: Agent.Info) {
  return railwiseAgentNames.has(agent.name) && !agent.hidden
}

function rank(agent: Agent.Info) {
  const index = railwiseAgents.findIndex(([name]) => name === agent.name)
  return index < 0 ? railwiseAgents.length : index
}

function group(id: string): ToolGroup {
  if (id === "task" || id === "skill") return "agent"
  if (id.startsWith("tool_wiki_") || id.startsWith("tool_norm_") || id.startsWith("standard_query_")) {
    return "knowledge"
  }
  if (
    id.startsWith("tool_adjustment_") ||
    id === "tool_format_converter" ||
    id === "tool_gross_error_detection" ||
    id === "tool_variance_component" ||
    [
      "angle_convert_",
      "axial_force_",
      "control_network_",
      "coord_transform_",
      "cpiii_adjustment_",
      "cross_section_",
      "deformation_rate_",
      "distance_calculator_",
      "excel_export_",
      "inclinometer_",
      "pile_stakeout_",
      "shield_guidance_",
      "survey_calculator_",
      "water_level_",
    ].some((prefix) => id.startsWith(prefix)) ||
    ["chart_generator", "format_parser", "monitoring_csv", "report_export"].includes(id)
  ) {
    return "survey"
  }
  if (
    [
      "bash",
      "read",
      "glob",
      "grep",
      "edit",
      "write",
      "webfetch",
      "websearch",
      "codesearch",
      "todowrite",
      "question",
      "apply_patch",
    ].includes(id)
  ) {
    return "core"
  }
  return "extension"
}

function toolLabel(id: string) {
  return labels[id] ?? id.replace(/^tool_/, "").replaceAll("_", " ")
}

async function inventory() {
  const order: ToolGroup[] = ["agent", "knowledge", "survey", "core", "extension"]
  return ToolRegistry.ids().then((ids) =>
    ids
      .filter((id) => id !== "invalid")
      .map((id) => ({
        id,
        label: toolLabel(id),
        group: group(id),
      }))
      .sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group) || a.label.localeCompare(b.label)),
  )
}

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
  const agentName =
    workflow.nodes.find((node) => node.agent === "chief_manager")?.agent ?? workflow.nodes[0]?.agent ?? "chief_manager"
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
            .filter(business)
            .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
            .map(async (agent) => {
              const source = file(agent.name)
              return {
                ...agent,
                displayName: displayName(agent),
                filePath: (await Bun.file(source).exists()) ? source : undefined,
                callCount7d: count.get(agent.name) ?? 0,
              }
            }),
        )
        return c.json(items)
      },
    )
    .get(
      "/tool/list",
      describeRoute({
        summary: "List agent collaboration tools",
        operationId: "agentStudio.tool.list",
        responses: {
          200: {
            description: "Tool inventory",
            content: {
              "application/json": {
                schema: resolver(ToolInventorySchema.array()),
              },
            },
          },
        },
      }),
      async (c) => c.json(await inventory()),
    )
    .get(
      "/skill/list",
      describeRoute({
        summary: "List available skills",
        operationId: "agentStudio.skill.list",
        responses: {
          200: {
            description: "Skill inventory",
            content: {
              "application/json": {
                schema: resolver(SkillInventorySchema.array()),
              },
            },
          },
        },
      }),
      async (c) =>
        c.json(
          (await Skill.all())
            .map((skill) => ({
              name: skill.name,
              description: skill.description,
              location: skill.location,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        ),
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
          displayName: displayName(agent),
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
