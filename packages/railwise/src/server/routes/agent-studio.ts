import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import matter from "gray-matter"
import path from "path"
import { mkdir, readdir, stat } from "fs/promises"
import z from "zod"
import { Agent } from "../../agent/agent"
import { AgentUpdated } from "../../agent/agent-events"
import presets from "../../agent/workflow-presets.json" with { type: "json" }
import { Bus } from "../../bus"
import { NormWiki } from "../../norm/wiki"
import { Instance } from "../../project/instance"
import { Session } from "../../session"
import { MessageTable } from "../../session/session.sql"
import { Database, gte } from "../../storage/db"
import {
  AdjustmentConditionTool,
  AdjustmentFreeNetworkTool,
  AdjustmentIndirectTool,
  AdjustmentRobustTool,
  GrossErrorDetectionTool,
} from "../../tool/adjustment"
import { FormatConverterTool } from "../../tool/format"
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

const WorkflowRunSchema = z
  .object({
    sessionId: z.string(),
    sessionTitle: z.string(),
    workflowId: z.string(),
    directory: z.string(),
    prompt: z.string(),
    agentNames: z.string().array(),
  })
  .meta({ ref: "WorkflowRun" })

const WorkflowCheckSchema = z
  .object({
    workflowId: z.string(),
    ok: z.boolean(),
    generatedAt: z.string(),
    checks: z
      .object({
        id: z.string(),
        label: z.string(),
        status: z.enum(["ok", "warn", "fail"]),
        detail: z.string(),
      })
      .array(),
  })
  .meta({ ref: "WorkflowCheck" })

const WikiReportSchema = z
  .object({
    path: z.string(),
    absolutePath: z.string(),
    kind: z.enum(["lint", "diff", "other"]),
    title: z.string(),
    generatedAt: z.string().optional(),
    status: z.string().optional(),
    problemCount: z.number().int().optional(),
    changeCount: z.number().int().optional(),
    updatedAt: z.string(),
  })
  .meta({ ref: "WikiReport" })

const WikiLogSchema = z
  .object({
    kind: z.enum(["query", "ingest", "other"]),
    timestamp: z.string().optional(),
    title: z.string(),
    paths: z.string().array(),
    raw: z.string(),
  })
  .meta({ ref: "WikiLogEntry" })

const WikiStatusSchema = z
  .object({
    root: z.string(),
    readonly: z.boolean(),
    pageCount: z.number().int(),
    rawCount: z.number().int(),
    indexPath: z.string().optional(),
    reportCount: z.number().int(),
    reports: z.array(WikiReportSchema),
    logCount: z.number().int(),
    logs: z.array(WikiLogSchema),
  })
  .meta({ ref: "WikiStatus" })

const WikiReportDetailSchema = WikiReportSchema.extend({
  rawMarkdown: z.string(),
}).meta({ ref: "WikiReportDetail" })

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
  return rows.reduce(
    (acc, row) => acc.set(row.data.agent, (acc.get(row.data.agent) ?? 0) + 1),
    new Map<string, number>(),
  )
}

function reportKind(name: string) {
  if (name.startsWith("lint-")) return "lint" as const
  if (name.startsWith("diff-")) return "diff" as const
  return "other" as const
}

function match(text: string, label: string) {
  return text.match(new RegExp(`^${label}:\\s*(.+)$`, "m"))?.[1]?.trim()
}

function count(text: string, label: string) {
  const value = Number(match(text, label))
  if (Number.isFinite(value)) return value
}

async function report(root: string, source: string) {
  const text = await Bun.file(source).text()
  const info = await stat(source)
  const kind = reportKind(path.basename(source))
  return {
    path: path.relative(root, source),
    absolutePath: source,
    kind,
    title: text.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? path.basename(source),
    generatedAt: match(text, "Generated"),
    status: match(text, "Status"),
    problemCount: kind === "lint" ? count(text, "Problem count") : undefined,
    changeCount: kind === "diff" ? count(text, "Change count") : undefined,
    updatedAt: info.mtime.toISOString(),
    rawMarkdown: text,
  }
}

async function reports(root: string) {
  const dir = path.join(root, "wiki", "changes")
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  const items = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
      .map((entry) => report(root, path.join(dir, entry.name))),
  )
  return items
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path))
    .map((item) => {
      const { rawMarkdown, ...summary } = item
      return summary
    })
}

async function reportDetail(input: string) {
  const root = await NormWiki.root()
  const rel = path.normalize(input)
  const prefix = path.join("wiki", "changes") + path.sep
  if (path.isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith(prefix) || !rel.endsWith(".md")) return
  const source = path.join(root, rel)
  const inside = path.relative(root, source)
  if (inside.startsWith("..") || path.isAbsolute(inside)) return
  if (!(await Bun.file(source).exists())) return
  return report(root, source)
}

async function wikiStatus() {
  const root = await NormWiki.root()
  const pages = await NormWiki.pages(root)
  const raws = await NormWiki.raws(root)
  const items = await reports(root)
  const logs = await NormWiki.logs({ source: root, limit: 50 })
  const index = path.join(root, "wiki", "index.md")
  const readonly =
    !Bun.env.RAILWISE_NORM_LIBRARY &&
    root !== path.join(Instance.directory, ".railwise", "norm-library") &&
    root !== path.join(Instance.worktree, ".railwise", "norm-library")
  return {
    root,
    readonly,
    pageCount: pages.length,
    rawCount: raws.length,
    indexPath: (await Bun.file(index).exists()) ? path.relative(root, index) : undefined,
    reportCount: items.length,
    reports: items.slice(0, 8),
    logCount: logs.length,
    logs: logs.slice(0, 5),
  }
}

function prompt(workflow: (typeof presets)[number], input?: Record<string, unknown>) {
  const nodes = workflow.nodes.map((node, index) => `${index + 1}. ${node.label} (@${node.agent})`).join("\n")
  const edges = workflow.edges.map((edge) => `${edge.from} -> ${edge.to}: ${edge.label ?? edge.kind}`).join("\n")
  const payload = input && Object.keys(input).length > 0 ? `\n\n输入参数：\n${JSON.stringify(input, null, 2)}` : ""
  const pack = workflow.id === "cpiii-resurvey-wiki" ? `\n\n${cpiii()}` : ""
  return (
    [
      `请按「${workflow.name}」执行工程测绘工作流。`,
      workflow.description,
      `节点：\n${nodes}`,
      `依赖关系：\n${edges}`,
      "请先输出 WBS、并行/串行关系、质量闸门和预期成果，再按节点推进。",
    ].join("\n\n") +
    pack +
    payload
  )
}

function cpiiiCosa() {
  return [
    "3.5,5,5",
    "CP300,4003.855,2903.360",
    "CP301,4094.969,3854.515",
    "CP300",
    "CP301,L,0",
    "CP301,S,339.366",
    "unknowns,dN_CP301,dE_CP301",
    "equation,baseline_north,dN_CP301=1,observed=0.002,weight=1",
    "equation,baseline_east,dE_CP301=1,observed=-0.001,weight=1",
    "equation,closure_vector,dN_CP301=1,dE_CP301=1,observed=0.0005,weight=0.8",
  ].join("\n")
}

function cpiii() {
  const network = {
    unknowns: ["dN_CP300", "dN_CP301"],
    equations: [
      { name: "relative_a", coefficients: { dN_CP300: -1, dN_CP301: 1 }, observed: 10 },
      { name: "relative_b", coefficients: { dN_CP300: -1, dN_CP301: 1 }, observed: 10.02 },
    ],
    constraints: [{ name: "centroid", coefficients: { dN_CP300: 1, dN_CP301: 1 }, value: 0 }],
  }
  const condition = {
    observations: [
      { name: "dh1", value: 100.001 },
      { name: "dh2", value: 200.002, weight: 4 },
      { name: "dh3", value: -300.006 },
    ],
    conditions: [{ name: "loop_closure", coefficients: { dh1: 1, dh2: 1, dh3: 1 } }],
  }
  return [
    "CPIII 工具执行包：",
    '1. norm_librarian 先调用 tool_wiki_query({"query":"CPIII 复测限差 平面 高程 控制网","scope":"CPIII","limit":5,"appendLog":true})，无命中再调用 tool_norm_search。',
    "2. railway_norm_consultant 用 tool_norm_cite 固化条文引用，所有限差判断必须带 wiki_page_path / raw_source_md / norm_clause_id。",
    "3. adjustment_computer 先调用 tool_format_converter 解析 COSA .in2 / CSV / NASEW 预处理文本，使用返回的 next.args 调用 tool_adjustment_indirect：",
    JSON.stringify({ sourceFormat: "cosa-in2", content: cpiiiCosa() }, null, 2),
    "4. adjustment_computer 对秩亏相对网或自由网任务调用 tool_adjustment_free_network，必须显式传入基准约束：",
    JSON.stringify(network, null, 2),
    "5. adjustment_computer 将 tool_adjustment_indirect 的 residuals 和 sigma0 交给 tool_gross_error_detection，标记疑似粗差后再输出最终质量意见。",
    "6. adjustment_computer 若发现疑似粗差但需要保留观测参与解算，调用 tool_adjustment_robust 输出 IGGIII 降权后的稳健平差结果。",
    "7. adjustment_computer 对闭合差、环线或约束方程类任务调用 tool_adjustment_condition，先用下列条件方程跑通平差链路：",
    JSON.stringify(condition, null, 2),
    "8. cpiii_specialist 汇总规范意见、平差成果、自由网/粗差/稳健平差/闭合差残差异常和复测建议，不在模型中手算控制网。",
    "9. knowledge_curator 检查 wiki/log.md 的查询记录，并把可复用结论沉淀为 Wiki 页面或维护报告。",
  ].join("\n")
}

function item(input: { id: string; label: string; status: "ok" | "warn" | "fail"; detail: string }) {
  return input
}

async function adjustmentCheck() {
  const format = await FormatConverterTool.init()
  const indirect = await AdjustmentIndirectTool.init()
  const free = await AdjustmentFreeNetworkTool.init()
  const gross = await GrossErrorDetectionTool.init()
  const robust = await AdjustmentRobustTool.init()
  const condition = await AdjustmentConditionTool.init()
  const converted = await format.execute(
    {
      sourceFormat: "cosa-in2",
      content: cpiiiCosa(),
    },
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const payload = JSON.parse(converted.output) as {
    next?: {
      args: {
        unknowns: string[]
        equations: { name?: string; coefficients: Record<string, number>; observed: number; weight?: number }[]
      }
    }
  }
  if (!payload.next) throw new Error("format converter did not produce adjustment payload")
  const indirectResult = await indirect.execute(
    payload.next.args,
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const indirectData = JSON.parse(indirectResult.output) as {
    residuals: { name: string; residual: number; weight: number }[]
    statistics?: { observationCount?: number; unknownCount?: number; unitWeightStdDev?: number }
  }
  const grossResult = await gross.execute(
    {
      residuals: indirectData.residuals,
      sigma0: indirectData.statistics?.unitWeightStdDev,
      threshold: 3,
    },
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const freeResult = await free.execute(
    {
      unknowns: ["dN_CP300", "dN_CP301"],
      equations: [
        { name: "relative_a", coefficients: { dN_CP300: -1, dN_CP301: 1 }, observed: 10 },
        { name: "relative_b", coefficients: { dN_CP300: -1, dN_CP301: 1 }, observed: 10.02 },
      ],
      constraints: [{ name: "centroid", coefficients: { dN_CP300: 1, dN_CP301: 1 }, value: 0 }],
    },
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const robustResult = await robust.execute(
    {
      unknowns: ["dN_CP301"],
      equations: [
        { name: "baseline_a", coefficients: { dN_CP301: 1 }, observed: 10 },
        { name: "baseline_b", coefficients: { dN_CP301: 1 }, observed: 10.01 },
        { name: "baseline_c", coefficients: { dN_CP301: 1 }, observed: 9.99 },
        { name: "baseline_d", coefficients: { dN_CP301: 1 }, observed: 10 },
        { name: "baseline_outlier", coefficients: { dN_CP301: 1 }, observed: 13 },
      ],
      k0: 0.8,
      k1: 1.6,
      minWeightFactor: 0.05,
    },
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const conditionResult = await condition.execute(
    {
      observations: [
        { name: "dh1", value: 100.001 },
        { name: "dh2", value: 200.002, weight: 4 },
        { name: "dh3", value: -300.006 },
      ],
      conditions: [{ name: "loop_closure", coefficients: { dh1: 1, dh2: 1, dh3: 1 } }],
    },
    {
      sessionID: "workflow-check",
      messageID: "workflow-check",
      agent: "agent-studio",
      abort: new AbortController().signal,
      messages: [],
      metadata() {},
      async ask() {},
    },
  )
  const grossData = JSON.parse(grossResult.output) as {
    statistics?: { grossErrorCount?: number; maxStatistic?: number }
  }
  const freeData = JSON.parse(freeResult.output) as {
    statistics?: { observationCount?: number; datumConstraintCount?: number; unitWeightStdDev?: number }
  }
  const robustData = JSON.parse(robustResult.output) as {
    statistics?: { iterationCount?: number; downweightedCount?: number }
  }
  const conditionData = JSON.parse(conditionResult.output) as {
    statistics?: { observationCount?: number; conditionCount?: number; unitWeightStdDev?: number }
  }
  return {
    indirect: indirectData.statistics,
    gross: grossData.statistics,
    free: freeData.statistics,
    robust: robustData.statistics,
    condition: conditionData.statistics,
  }
}

async function check(workflow: (typeof presets)[number]) {
  const agents = await Agent.list().then((items) => new Set(items.map((agent) => agent.name)))
  const ids = await ToolRegistry.ids().then((items) => new Set(items))
  const root = await NormWiki.root()
  const pages = await NormWiki.pages(root)
  const raws = await NormWiki.raws(root)
  const logs = await NormWiki.logs({ source: root, limit: 1 })
  const index = await Bun.file(path.join(root, "wiki", "index.md")).exists()
  const missing = workflow.nodes.map((node) => node.agent).filter((agent) => !agents.has(agent))
  const tools = [
    "tool_wiki_query",
    "tool_norm_search",
    "tool_norm_cite",
    "tool_format_converter",
    "tool_adjustment_indirect",
    "tool_adjustment_free_network",
    "tool_adjustment_robust",
    "tool_adjustment_condition",
    "tool_gross_error_detection",
  ]
  const missingTools = tools.filter((tool) => !ids.has(tool))
  const stats =
    ids.has("tool_format_converter") &&
    ids.has("tool_adjustment_indirect") &&
    ids.has("tool_adjustment_free_network") &&
    ids.has("tool_adjustment_robust") &&
    ids.has("tool_adjustment_condition") &&
    ids.has("tool_gross_error_detection")
      ? await adjustmentCheck().catch(() => undefined)
      : undefined
  const checks = [
    item({
      id: "agents",
      label: "智能体",
      status: missing.length ? "fail" : "ok",
      detail: missing.length ? `缺少 ${missing.join(", ")}` : `${workflow.nodes.length} 个节点已注册`,
    }),
    item({
      id: "tools",
      label: "工具",
      status: missingTools.length ? "fail" : "ok",
      detail: missingTools.length ? `缺少 ${missingTools.join(", ")}` : `${tools.length} 个核心工具已注册`,
    }),
    item({
      id: "norm",
      label: "规范库",
      status: pages.length && raws.length && index ? "ok" : "fail",
      detail: `${pages.length} Wiki 页，${raws.length} Raw 源，index ${index ? "存在" : "缺失"}`,
    }),
    item({
      id: "adjustment",
      label: "平差工具",
      status: stats ? "ok" : "fail",
      detail: stats
        ? `间接 ${stats.indirect?.observationCount ?? 0} 条观测、${stats.indirect?.unknownCount ?? 0} 个未知数，sigma0=${(stats.indirect?.unitWeightStdDev ?? 0).toPrecision(3)}；自由网 ${stats.free?.observationCount ?? 0} 条观测、${stats.free?.datumConstraintCount ?? 0} 个基准约束，sigma0=${(stats.free?.unitWeightStdDev ?? 0).toPrecision(3)}；粗差 ${stats.gross?.grossErrorCount ?? 0} 项，max=${(stats.gross?.maxStatistic ?? 0).toPrecision(3)}；稳健 ${stats.robust?.iterationCount ?? 0} 次迭代、降权 ${stats.robust?.downweightedCount ?? 0} 项；条件 ${stats.condition?.observationCount ?? 0} 条观测、${stats.condition?.conditionCount ?? 0} 个条件，sigma0=${(stats.condition?.unitWeightStdDev ?? 0).toPrecision(3)}`
        : "样例平差或条件平差未通过",
    }),
    item({
      id: "activity",
      label: "Wiki 活动",
      status: logs.length ? "ok" : "warn",
      detail: logs.length ? "已有查询/维护记录" : "暂无查询/维护记录，首次运行后会生成",
    }),
  ]
  return {
    workflowId: workflow.id,
    ok: checks.every((check) => check.status !== "fail"),
    generatedAt: new Date().toISOString(),
    checks,
  }
}

export const AgentStudioRoutes = lazy(() => {
  const schema = {
    list: Agent.Info.extend({
      filePath: z.string().optional().meta({
        description: "Absolute path of the backing .md file.",
      }),
      callCount7d: z.number().int().optional().meta({
        description: "Message count by this agent in the last 7 days.",
      }),
    }).meta({ ref: "AgentListItem" }),
    detail: Agent.Info.extend({
      filePath: z.string().optional(),
      rawMarkdown: z.string().meta({
        description: "Full markdown source including frontmatter.",
      }),
    }).meta({ ref: "AgentDetail" }),
  }

  return new Hono()
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
                schema: resolver(schema.list.array()),
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
      "/wiki/status",
      describeRoute({
        summary: "Get norm Wiki status",
        description: "Returns current norm library counts and recent lint/diff change reports.",
        operationId: "agentStudio.wiki.status",
        responses: {
          200: {
            description: "Norm Wiki status",
            content: {
              "application/json": {
                schema: resolver(WikiStatusSchema),
              },
            },
          },
        },
      }),
      async (c) => c.json(await wikiStatus()),
    )
    .get(
      "/workflow/check/:id",
      describeRoute({
        summary: "Check workflow readiness",
        description: "Runs deterministic readiness checks for the selected workflow preset.",
        operationId: "agentStudio.workflow.check",
        responses: {
          200: {
            description: "Workflow readiness check",
            content: {
              "application/json": {
                schema: resolver(WorkflowCheckSchema),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator("param", z.object({ id: z.string().min(1) })),
      async (c) => {
        const workflow = presets.find((item) => item.id === c.req.valid("param").id)
        if (!workflow) return c.json({ error: "workflow not found" }, 404)
        return c.json(await check(workflow))
      },
    )
    .get(
      "/wiki/report",
      describeRoute({
        summary: "Get norm Wiki report detail",
        description: "Returns a single lint/diff report markdown file from wiki/changes.",
        operationId: "agentStudio.wiki.report",
        responses: {
          200: {
            description: "Norm Wiki report detail",
            content: {
              "application/json": {
                schema: resolver(WikiReportDetailSchema),
              },
            },
          },
          ...errors(400, 404),
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string().min(1),
        }),
      ),
      async (c) => {
        const found = await reportDetail(c.req.valid("query").path)
        if (!found) return c.json({ error: "report not found" }, 404)
        return c.json(found)
      },
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
              "application/json": { schema: resolver(schema.detail) },
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
        description: "Creates a real session and returns the selected workflow prompt for user review.",
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
        const text = prompt(workflow, body.input)
        return c.json({
          sessionId: session.id,
          sessionTitle: title,
          workflowId: workflow.id,
          directory: Instance.directory,
          prompt: text,
          agentNames: [...new Set(workflow.nodes.map((node) => node.agent))],
        })
      },
    )
})
