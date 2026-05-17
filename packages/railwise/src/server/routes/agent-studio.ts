import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import matter from "gray-matter"
import path from "path"
import { mkdir, readdir, stat } from "fs/promises"
import z from "zod"
import { Agent } from "../../agent/agent"
import { AgentUpdated, WorkflowCompleted } from "../../agent/agent-events"
import presets from "../../agent/workflow-presets.json" with { type: "json" }
import { Bus } from "../../bus"
import { NormWiki } from "../../norm/wiki"
import { Instance } from "../../project/instance"
import { Session } from "../../session"
import type { MessageV2 } from "../../session/message-v2"
import { MessageTable, SessionTable } from "../../session/session.sql"
import { Skill } from "../../skill"
import { and, Database, eq, gte } from "../../storage/db"
import {
  AdjustmentConditionTool,
  AdjustmentFreeNetworkTool,
  AdjustmentIndirectTool,
  AdjustmentRobustTool,
  GrossErrorDetectionTool,
  VarianceComponentTool,
} from "../../tool/adjustment"
import { FormatConverterTool } from "../../tool/format"
import { FormatSamples } from "../../tool/format-samples"
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

const WorkflowRunArtifactSchema = z
  .object({
    kind: z.literal("format-coverage"),
    title: z.string(),
    markdownPath: z.string(),
    absoluteMarkdownPath: z.string(),
    jsonPath: z.string(),
    absoluteJsonPath: z.string(),
  })
  .meta({ ref: "WorkflowRunArtifact" })

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
    directory: z.string(),
    prompt: z.string(),
    agentNames: z.string().array(),
    artifacts: WorkflowRunArtifactSchema.array().optional(),
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

const WorkflowAcceptanceCheckSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    status: z.enum(["ok", "warn", "fail"]),
    detail: z.string(),
  })
  .meta({ ref: "WorkflowAcceptanceCheck" })

const WorkflowAcceptanceSchema = z
  .object({
    workflowId: z.string(),
    sessionId: z.string(),
    ok: z.boolean(),
    generatedAt: z.string(),
    messageCount: z.number().int(),
    checks: WorkflowAcceptanceCheckSchema.array(),
  })
  .meta({ ref: "WorkflowAcceptance" })

const WORKFLOW_DELIVERY_MANIFEST_KIND = "railwise.workflow.delivery"
const WORKFLOW_DELIVERY_MANIFEST_VERSION = 1
const WORKFLOW_DELIVERY_PACKAGE_VERSION = 1

const WorkflowDeliveryReferenceSchema = z
  .object({
    label: z.string(),
    path: z.string(),
    absolutePath: z.string().optional(),
  })
  .meta({ ref: "WorkflowDeliveryReference" })

const WorkflowDeliveryFileSchema = z
  .object({
    kind: z.enum(["summary", "manifest", "artifact"]),
    label: z.string(),
    path: z.string(),
    absolutePath: z.string(),
    sourcePath: z.string().optional(),
    copied: z.boolean(),
  })
  .meta({ ref: "WorkflowDeliveryFile" })

const WorkflowDeliveryArchiveSchema = z
  .object({
    sessionId: z.string(),
    workflowId: z.string(),
    workflowName: z.string(),
    version: z.literal(WORKFLOW_DELIVERY_PACKAGE_VERSION),
    generatedAt: z.string(),
    directoryPath: z.string().optional(),
    absoluteDirectoryPath: z.string().optional(),
    markdownPath: z.string(),
    absoluteMarkdownPath: z.string(),
    manifestPath: z.string().optional(),
    absoluteManifestPath: z.string().optional(),
    fileCount: z.number().int().optional(),
    files: WorkflowDeliveryFileSchema.array().optional(),
  })
  .meta({ ref: "WorkflowDeliveryArchive" })

const WorkflowDeliveryManifestSchema = z
  .object({
    kind: z.literal(WORKFLOW_DELIVERY_MANIFEST_KIND),
    version: z.literal(WORKFLOW_DELIVERY_MANIFEST_VERSION),
    delivery: WorkflowDeliveryArchiveSchema,
    acceptance: WorkflowAcceptanceSchema,
    references: WorkflowDeliveryReferenceSchema.array(),
  })
  .meta({ ref: "WorkflowDeliveryManifest" })

const WorkflowSessionSchema = z
  .object({
    sessionId: z.string(),
    workflowId: z.string(),
    workflowName: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    artifacts: WorkflowRunArtifactSchema.array().optional(),
    acceptance: WorkflowAcceptanceSchema.optional(),
    delivery: WorkflowDeliveryArchiveSchema.optional(),
  })
  .meta({ ref: "WorkflowSession" })

const WikiReportSchema = z
  .object({
    path: z.string(),
    absolutePath: z.string(),
    kind: z.enum(["lint", "diff", "format", "other"]),
    title: z.string(),
    generatedAt: z.string().optional(),
    status: z.string().optional(),
    problemCount: z.number().int().optional(),
    changeCount: z.number().int().optional(),
    sampleCount: z.number().int().optional(),
    readyCount: z.number().int().optional(),
    formatCount: z.number().int().optional(),
    coveredFormatCount: z.number().int().optional(),
    warningCount: z.number().int().optional(),
    jsonPath: z.string().optional(),
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

const FormatSampleReportSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    sourceFormat: z.string(),
    expectedFormat: z.string(),
    detectedFormat: z.string(),
    ready: z.boolean(),
    damaged: z.boolean().optional(),
    warningCount: z.number().int(),
    warningLines: z.number().int().array(),
    warnings: z.string().array(),
    pointCount: z.number().int(),
    observationCount: z.number().int(),
    equationCount: z.number().int(),
    unknowns: z.string().array(),
    equationNames: z.string().array(),
    nextTool: z.string().optional(),
  })
  .meta({ ref: "FormatSampleReport" })

const FormatCoverageArtifactsSchema = z
  .object({
    markdownPath: z.string(),
    absoluteMarkdownPath: z.string(),
    jsonPath: z.string(),
    absoluteJsonPath: z.string(),
  })
  .meta({ ref: "FormatCoverageArtifacts" })

const FormatCoverageReportSchema = z
  .object({
    generatedAt: z.string(),
    sampleCount: z.number().int(),
    readyCount: z.number().int(),
    formatCount: z.number().int(),
    coveredFormatCount: z.number().int(),
    warningCount: z.number().int(),
    samples: FormatSampleReportSchema.array(),
    artifacts: FormatCoverageArtifactsSchema.optional(),
  })
  .meta({ ref: "FormatCoverageReport" })

type FormatCoverageReport = z.infer<typeof FormatCoverageReportSchema>
type FormatCoverageCore = Omit<FormatCoverageReport, "artifacts">
type WorkflowRunArtifact = z.infer<typeof WorkflowRunArtifactSchema>
type WorkflowAcceptance = z.infer<typeof WorkflowAcceptanceSchema>
type WorkflowDeliveryFile = z.infer<typeof WorkflowDeliveryFileSchema>
type WorkflowDeliveryArchive = z.infer<typeof WorkflowDeliveryArchiveSchema>
type WorkflowSession = z.infer<typeof WorkflowSessionSchema>
type DeliveryReference = z.infer<typeof WorkflowDeliveryReferenceSchema>
type FormatConverted = {
  detectedFormat?: string
  points?: unknown[]
  observations?: unknown[]
  warnings?: string[]
  next?: {
    tool?: string
    args: {
      unknowns: string[]
      equations: { name?: string; coefficients: Record<string, number>; observed: number; weight?: number }[]
    }
  }
}

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
  ["chief_manager", "项目总控"],
  ["solution_architect", "技术方案架构师"],
  ["qa_inspector", "外业数据首检"],
  ["data_analyst", "测绘数据分析"],
  ["qa_reviewer", "总工办质检"],
  ["technical_writer", "工程报告编制"],
  ["commercial_specialist", "商务招投标"],
  ["ppt_master", "汇报材料设计"],
  ["cpiii_specialist", "CPIII 测量专家"],
  ["adjustment_computer", "严密平差计算"],
  ["railway_norm_consultant", "铁路规范顾问"],
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

function localNormRoot() {
  return path.join(Instance.directory, ".railwise", "norm-library")
}

function worktreeNormRoot() {
  return path.join(Instance.worktree, ".railwise", "norm-library")
}

function workflowSessionDir() {
  return path.join(Instance.directory, ".railwise", "workflow-sessions")
}

function workflowDeliveryDir() {
  return path.join(Instance.directory, ".railwise", "workflow-deliveries")
}

function safeSessionId(sessionId: string) {
  return sessionId.replace(/[^A-Za-z0-9_.-]/g, "_")
}

function workflowSessionPath(sessionId: string) {
  return path.join(workflowSessionDir(), `${safeSessionId(sessionId)}.json`)
}

function workflowDeliveryPackageDir(sessionId: string) {
  return path.join(workflowDeliveryDir(), safeSessionId(sessionId))
}

function workflowDeliveryPath(sessionId: string) {
  return path.join(workflowDeliveryPackageDir(sessionId), "summary.md")
}

function workflowDeliveryManifestPath(sessionId: string) {
  return path.join(workflowDeliveryPackageDir(sessionId), "manifest.json")
}

async function workflowSession(sessionId: string) {
  const source = workflowSessionPath(sessionId)
  const file = Bun.file(source)
  if (!(await file.exists())) return
  return WorkflowSessionSchema.parse(await file.json())
}

async function saveWorkflowSession(input: {
  sessionId: string
  workflowId: string
  workflowName: string
  artifacts?: WorkflowRunArtifact[]
  acceptance?: WorkflowAcceptance
  delivery?: WorkflowDeliveryArchive
}) {
  const now = new Date().toISOString()
  const prev = await workflowSession(input.sessionId)
  const next: WorkflowSession = {
    ...prev,
    ...input,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  }
  await mkdir(workflowSessionDir(), { recursive: true })
  await Bun.write(workflowSessionPath(input.sessionId), `${JSON.stringify(next, null, 2)}\n`)
  return next
}

async function reportRoots() {
  const root = await NormWiki.root()
  return [...new Set([root, localNormRoot(), worktreeNormRoot()])]
}

async function writableNormRoot() {
  const root = await NormWiki.root()
  const local = localNormRoot()
  const worktree = worktreeNormRoot()
  if (Bun.env.RAILWISE_NORM_LIBRARY || root === local || root === worktree) return root
  return local
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
      .innerJoin(SessionTable, eq(MessageTable.session_id, SessionTable.id))
      .where(
        and(
          eq(SessionTable.project_id, Instance.project.id),
          eq(SessionTable.directory, Instance.directory),
          gte(MessageTable.time_created, Date.now() - 7 * 24 * 60 * 60 * 1000),
        ),
      )
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
  if (name.startsWith("format-coverage-")) return "format" as const
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
    sampleCount: kind === "format" ? count(text, "Sample count") : undefined,
    readyCount: kind === "format" ? count(text, "Ready count") : undefined,
    formatCount: kind === "format" ? count(text, "Format count") : undefined,
    coveredFormatCount: kind === "format" ? count(text, "Covered format count") : undefined,
    warningCount: kind === "format" ? count(text, "Warning count") : undefined,
    jsonPath: kind === "format" ? match(text, "JSON attachment") : undefined,
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
  const rel = path.normalize(input)
  const prefix = path.join("wiki", "changes") + path.sep
  if (path.isAbsolute(rel) || rel.startsWith("..") || !rel.startsWith(prefix) || !rel.endsWith(".md")) return
  for (const root of (await reportRoots()).reverse()) {
    const source = path.join(root, rel)
    const inside = path.relative(root, source)
    if (inside.startsWith("..") || path.isAbsolute(inside)) continue
    if (await Bun.file(source).exists()) return report(root, source)
  }
}

async function wikiStatus() {
  const root = await NormWiki.root()
  const pages = await NormWiki.pages(root)
  const raws = await NormWiki.raws(root)
  const items = [
    ...new Map(
      (await Promise.all((await reportRoots()).map((root) => reports(root))))
        .flat()
        .map((report) => [report.path, report] as const),
    ).values(),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.path.localeCompare(b.path))
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

function prompt(
  workflow: (typeof presets)[number],
  input?: Record<string, unknown>,
  artifacts: WorkflowRunArtifact[] = [],
) {
  const nodes = workflow.nodes.map((node, index) => `${index + 1}. ${node.label} (@${node.agent})`).join("\n")
  const edges = workflow.edges.map((edge) => `${edge.from} -> ${edge.to}: ${edge.label ?? edge.kind}`).join("\n")
  const payload = input && Object.keys(input).length > 0 ? `\n\n输入参数：\n${JSON.stringify(input, null, 2)}` : ""
  const pack = workflow.id === "cpiii-resurvey-wiki" ? `\n\n${cpiii(artifacts[0])}` : ""
  return attach(
    [
      `请按「${workflow.name}」执行工程测绘工作流。`,
      workflow.description,
      `节点：\n${nodes}`,
      `依赖关系：\n${edges}`,
      "请先输出 WBS、并行/串行关系、质量闸门和预期成果，再按节点推进。",
    ].join("\n\n") +
      pack +
      payload,
    artifacts,
  )
}

function attach(text: string, artifacts: WorkflowRunArtifact[]) {
  if (!artifacts.length) return text
  return [
    text,
    "",
    "工作流附件：",
    ...artifacts.flatMap((item) => [
      `- ${item.title} Markdown: ${item.markdownPath}`,
      `- ${item.title} JSON: ${item.jsonPath}`,
      `- 本地 Markdown: ${item.absoluteMarkdownPath}`,
      `- 本地 JSON: ${item.absoluteJsonPath}`,
    ]),
    "交付验收硬性要求：",
    "- chief_manager 必须把上述附件路径逐字传给 technical_writer 和 knowledge_curator。",
    "- technical_writer 的复测预案或技术报告必须包含「附件引用」小节，并逐字列出 Markdown 与 JSON 两个路径。",
    "- knowledge_curator 的维护摘要必须记录同一组 Markdown 与 JSON 路径，并说明是否已进入 Wiki 变更报告。",
    "- 若任一交付物缺少上述路径，chief_manager 必须判定为不完整交付并要求返工。",
  ].join("\n")
}

function cpiii(artifact?: WorkflowRunArtifact) {
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
  const mixed = {
    unknowns: ["dN_CP301"],
    referenceGroup: "distance",
    equations: [
      { name: "distance_a", group: "distance", coefficients: { dN_CP301: 1 }, observed: 10 },
      { name: "distance_b", group: "distance", coefficients: { dN_CP301: 1 }, observed: 10.02 },
      { name: "angle_a", group: "angle", coefficients: { dN_CP301: 1 }, observed: 10.5 },
      { name: "angle_b", group: "angle", coefficients: { dN_CP301: 1 }, observed: 9.5 },
    ],
  }
  const md = artifact?.markdownPath ?? `wiki/changes/${artifactBase(new Date().toISOString())}.md`
  const json = artifact?.jsonPath ?? md.replace(/\.md$/, ".json")
  return [
    "CPIII 工具执行包：",
    '1. norm_librarian 先调用 tool_wiki_query({"query":"CPIII 复测限差 平面 高程 控制网","scope":"CPIII","limit":5,"appendLog":true})，无命中再调用 tool_norm_search。',
    "2. railway_norm_consultant 用 tool_norm_cite 固化条文引用，所有限差判断必须带 wiki_page_path / raw_source_md / norm_clause_id。",
    "3. adjustment_computer 先调用 tool_format_converter 解析 COSA .in2/.in1、NASEW .dat、南方 .in、LGO ASCII、TBC CSV 或通用 CSV，使用返回的 next.args 调用 tool_adjustment_indirect：",
    JSON.stringify({ sourceFormat: "cosa-in2", content: FormatSamples.get("cosa-in2").content }, null, 2),
    "4. adjustment_computer 对秩亏相对网或自由网任务调用 tool_adjustment_free_network，必须显式传入基准约束：",
    JSON.stringify(network, null, 2),
    "5. adjustment_computer 将 tool_adjustment_indirect 的 residuals 和 sigma0 交给 tool_gross_error_detection，标记疑似粗差后再输出最终质量意见。",
    "6. adjustment_computer 若发现疑似粗差但需要保留观测参与解算，调用 tool_adjustment_robust 输出 IGGIII 降权后的稳健平差结果。",
    "7. adjustment_computer 对距离/角度/GNSS 等混合观测组调用 tool_variance_component，估计相对方差分量和建议权因子：",
    JSON.stringify(mixed, null, 2),
    "8. adjustment_computer 对闭合差、环线或约束方程类任务调用 tool_adjustment_condition，先用下列条件方程跑通平差链路：",
    JSON.stringify(condition, null, 2),
    "9. cpiii_specialist 汇总规范意见、平差成果、自由网/粗差/稳健平差/方差分量/闭合差残差异常和复测建议，不在模型中手算控制网。",
    `10. technical_writer 在复测预案和技术报告的「附件引用」小节中逐字引用格式兼容性质检报告 ${md} 及 ${json}，说明支持格式覆盖、样本可用率和损坏行 warning。`,
    `11. knowledge_curator 检查 wiki/log.md 的查询记录，并在维护摘要中记录 ${md} 与 ${json}；若路径缺失或未进入变更报告，输出阻塞项而不是通过验收。`,
  ].join("\n")
}

function item(input: { id: string; label: string; status: "ok" | "warn" | "fail"; detail: string }) {
  return input
}

function toolctx() {
  return {
    sessionID: "workflow-check",
    messageID: "workflow-check",
    agent: "agent-studio",
    abort: new AbortController().signal,
    messages: [],
    metadata() {},
    async ask() {},
  }
}

function warningLines(warnings: string[]) {
  return warnings.flatMap((warning) => {
    const line = Number(warning.match(/\bLine\s+(\d+)\b/)?.[1])
    return Number.isFinite(line) ? [line] : []
  })
}

async function formatCorpus() {
  const format = await FormatConverterTool.init()
  return Promise.all(
    FormatSamples.list.map(async (sample) => ({
      sample,
      converted: JSON.parse(
        (await format.execute({ sourceFormat: sample.sourceFormat, content: sample.content }, toolctx())).output,
      ) as FormatConverted,
    })),
  )
}

function coverage(corpus: Awaited<ReturnType<typeof formatCorpus>>): FormatCoverageCore {
  const samples = corpus.map((entry) => {
    const warnings = entry.converted.warnings ?? []
    const next = entry.converted.next
    const equations = next?.args.equations ?? []
    return {
      id: entry.sample.id,
      label: entry.sample.label,
      sourceFormat: entry.sample.sourceFormat,
      expectedFormat: entry.sample.expectedFormat,
      detectedFormat: entry.converted.detectedFormat ?? "unknown",
      ready: Boolean(next) && entry.converted.detectedFormat === entry.sample.expectedFormat,
      damaged: "damaged" in entry.sample ? entry.sample.damaged : undefined,
      warningCount: warnings.length,
      warningLines: warningLines(warnings),
      warnings,
      pointCount: entry.converted.points?.length ?? 0,
      observationCount: entry.converted.observations?.length ?? 0,
      equationCount: equations.length,
      unknowns: next?.args.unknowns ?? [],
      equationNames: equations.flatMap((equation) => (equation.name ? [equation.name] : [])),
      nextTool: next?.tool,
    }
  })
  const formats = new Set(FormatSamples.list.map((sample) => sample.expectedFormat))
  return {
    generatedAt: new Date().toISOString(),
    sampleCount: samples.length,
    readyCount: samples.filter((sample) => sample.ready).length,
    formatCount: formats.size,
    coveredFormatCount: [...formats].filter((format) =>
      samples.some((sample) => sample.ready && sample.detectedFormat === format),
    ).length,
    warningCount: samples.reduce((sum, sample) => sum + sample.warningCount, 0),
    samples,
  }
}

function artifactBase(generatedAt: string) {
  return `format-coverage-${generatedAt.slice(0, 10)}`
}

function cell(value: string | number | boolean | undefined) {
  return String(value ?? "-")
    .replaceAll("|", "\\|")
    .replaceAll("\n", "<br>")
}

function markdown(report: FormatCoverageCore, jsonPath: string) {
  const rows = report.samples.map((sample) =>
    [
      sample.label,
      sample.expectedFormat,
      sample.detectedFormat,
      sample.ready ? "ready" : "blocked",
      sample.pointCount,
      sample.observationCount,
      sample.equationCount,
      sample.unknowns.join(", ") || "-",
      sample.warningCount ? `${sample.warningCount} (${sample.warningLines.join(", ") || "no line"})` : "0",
      sample.nextTool ?? "-",
    ]
      .map(cell)
      .join(" | "),
  )
  const warnings = report.samples
    .filter((sample) => sample.warnings.length)
    .flatMap((sample) => [`### ${sample.label}`, "", ...sample.warnings.map((warning) => `- ${warning}`), ""])
  return [
    "# RAILWISE Format Coverage Report",
    "",
    `Generated: ${report.generatedAt}`,
    `Status: ${report.readyCount === report.sampleCount && report.coveredFormatCount === report.formatCount ? "ready" : "needs_attention"}`,
    `Sample count: ${report.sampleCount}`,
    `Ready count: ${report.readyCount}`,
    `Format count: ${report.formatCount}`,
    `Covered format count: ${report.coveredFormatCount}`,
    `Warning count: ${report.warningCount}`,
    `JSON attachment: ${jsonPath}`,
    "",
    "## Delivery Use",
    "",
    "- 用作 CPIII 复测预案与技术报告的格式兼容性质检附件。",
    "- 技术报告引用本 Markdown 摘要，工程归档系统引用同名 JSON 保留机器可读诊断。",
    "- warning 行号必须进入外业数据首检意见，避免损坏行在报告链路中被静默吞掉。",
    "",
    "## Sample Coverage",
    "",
    "| Sample | Expected | Detected | Ready | Points | Observations | Equations | Unknowns | Warnings | Next Tool |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |",
    ...rows.map((row) => `| ${row} |`),
    "",
    "## Warning Details",
    "",
    ...(warnings.length ? warnings : ["No warnings.", ""]),
  ].join("\n")
}

async function persist(report: FormatCoverageCore) {
  const root = await writableNormRoot()
  const dir = path.join(root, "wiki", "changes")
  const base = artifactBase(report.generatedAt)
  const md = path.join(dir, `${base}.md`)
  const json = path.join(dir, `${base}.json`)
  const jsonPath = path.relative(root, json)
  await mkdir(dir, { recursive: true })
  await Bun.write(json, `${JSON.stringify(report, null, 2)}\n`)
  await Bun.write(md, markdown(report, jsonPath))
  return {
    markdownPath: path.relative(root, md),
    absoluteMarkdownPath: md,
    jsonPath,
    absoluteJsonPath: json,
  }
}

async function formatReport() {
  const data = coverage(await formatCorpus())
  return { ...data, artifacts: await persist(data) }
}

async function runArtifacts(workflow: (typeof presets)[number]) {
  if (workflow.id !== "cpiii-resurvey-wiki") return []
  const report = await formatReport()
  return [
    {
      kind: "format-coverage" as const,
      title: "格式兼容性质检报告",
      markdownPath: report.artifacts.markdownPath,
      absoluteMarkdownPath: report.artifacts.absoluteMarkdownPath,
      jsonPath: report.artifacts.jsonPath,
      absoluteJsonPath: report.artifacts.absoluteJsonPath,
    },
  ]
}

async function adjustmentCheck() {
  const indirect = await AdjustmentIndirectTool.init()
  const free = await AdjustmentFreeNetworkTool.init()
  const gross = await GrossErrorDetectionTool.init()
  const robust = await AdjustmentRobustTool.init()
  const variance = await VarianceComponentTool.init()
  const condition = await AdjustmentConditionTool.init()
  const corpus = await formatCorpus()
  const report = coverage(corpus)
  const base = corpus.find((entry) => entry.sample.id === "cosa-in2")?.converted
  if (!base?.next) throw new Error("format converter did not produce adjustment payload")
  const indirectResult = await indirect.execute(base.next.args, toolctx())
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
    toolctx(),
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
    toolctx(),
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
    toolctx(),
  )
  const varianceResult = await variance.execute(
    {
      unknowns: ["dN_CP301"],
      referenceGroup: "distance",
      equations: [
        { name: "distance_a", group: "distance", coefficients: { dN_CP301: 1 }, observed: 10 },
        { name: "distance_b", group: "distance", coefficients: { dN_CP301: 1 }, observed: 10.02 },
        { name: "angle_a", group: "angle", coefficients: { dN_CP301: 1 }, observed: 10.5 },
        { name: "angle_b", group: "angle", coefficients: { dN_CP301: 1 }, observed: 9.5 },
      ],
    },
    toolctx(),
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
    toolctx(),
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
  const varianceData = JSON.parse(varianceResult.output) as {
    statistics?: { groupCount?: number; referenceVarianceFactor?: number }
  }
  const conditionData = JSON.parse(conditionResult.output) as {
    statistics?: { observationCount?: number; conditionCount?: number; unitWeightStdDev?: number }
  }
  const damaged = report.samples.find((sample) => sample.damaged)
  return {
    format: {
      supportedFormatCount: report.formatCount,
      readyFormatCount: report.coveredFormatCount,
      corpusSampleCount: report.sampleCount,
      corpusReadyCount: report.readyCount,
      detectedFormats: report.samples.map((sample) => sample.detectedFormat),
      damagedReady: Boolean(damaged?.ready),
      warningCount: report.warningCount,
    },
    indirect: indirectData.statistics,
    gross: grossData.statistics,
    free: freeData.statistics,
    robust: robustData.statistics,
    variance: varianceData.statistics,
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
    "tool_variance_component",
    "tool_adjustment_condition",
    "tool_gross_error_detection",
  ]
  const missingTools = tools.filter((tool) => !ids.has(tool))
  const stats =
    ids.has("tool_format_converter") &&
    ids.has("tool_adjustment_indirect") &&
    ids.has("tool_adjustment_free_network") &&
    ids.has("tool_adjustment_robust") &&
    ids.has("tool_variance_component") &&
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
        ? `格式 ${stats.format?.readyFormatCount ?? 0}/${stats.format?.supportedFormatCount ?? 0} 种可转平差，样本集 ${stats.format?.corpusReadyCount ?? 0}/${stats.format?.corpusSampleCount ?? 0} 可用、容错样本 ${stats.format?.damagedReady ? "可用" : "失败"}、warning ${stats.format?.warningCount ?? 0} 条；间接 ${stats.indirect?.observationCount ?? 0} 条观测、${stats.indirect?.unknownCount ?? 0} 个未知数，sigma0=${(stats.indirect?.unitWeightStdDev ?? 0).toPrecision(3)}；自由网 ${stats.free?.observationCount ?? 0} 条观测、${stats.free?.datumConstraintCount ?? 0} 个基准约束，sigma0=${(stats.free?.unitWeightStdDev ?? 0).toPrecision(3)}；粗差 ${stats.gross?.grossErrorCount ?? 0} 项，max=${(stats.gross?.maxStatistic ?? 0).toPrecision(3)}；稳健 ${stats.robust?.iterationCount ?? 0} 次迭代、降权 ${stats.robust?.downweightedCount ?? 0} 项；方差分量 ${stats.variance?.groupCount ?? 0} 类，ref=${(stats.variance?.referenceVarianceFactor ?? 0).toPrecision(3)}；条件 ${stats.condition?.observationCount ?? 0} 条观测、${stats.condition?.conditionCount ?? 0} 个条件，sigma0=${(stats.condition?.unitWeightStdDev ?? 0).toPrecision(3)}`
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

function partText(part: MessageV2.Part) {
  if (part.type !== "text" || part.ignored || part.synthetic) return ""
  return part.text
}

function artifactPaths(text: string) {
  return {
    markdown: [...new Set(text.match(/wiki\/changes\/format-coverage-\d{4}-\d{2}-\d{2}\.md/g) ?? [])],
    json: [...new Set(text.match(/wiki\/changes\/format-coverage-\d{4}-\d{2}-\d{2}\.json/g) ?? [])],
  }
}

function includesAll(text: string, values: string[]) {
  return values.length > 0 && values.every((value) => text.includes(value))
}

function markdownCell(value: string | number | boolean) {
  return String(value).replace(/\|/g, "\\|").replace(/\n/g, "<br>")
}

function checkStatusLabel(status: WorkflowAcceptance["checks"][number]["status"]) {
  if (status === "ok") return "通过"
  if (status === "warn") return "提示"
  return "阻塞"
}

async function sessionText(sessionId: string) {
  const messages = await Session.messages({ sessionID: sessionId })
  return messages.map((message) => message.parts.map(partText).join("\n")).join("\n")
}

function deliveryReferences(artifacts: WorkflowRunArtifact[], text: string): DeliveryReference[] {
  if (artifacts.length)
    return artifacts.flatMap((artifact) => [
      { label: `${artifact.title} Markdown`, path: artifact.markdownPath, absolutePath: artifact.absoluteMarkdownPath },
      { label: `${artifact.title} JSON`, path: artifact.jsonPath, absolutePath: artifact.absoluteJsonPath },
    ])
  const source = artifactPaths(text)
  return [
    ...source.markdown.map((item) => ({ label: "Markdown", path: item })),
    ...source.json.map((item) => ({ label: "JSON", path: item })),
  ]
}

function packageArtifactName(index: number, source: string) {
  return `artifact-${String(index + 1).padStart(2, "0")}${path.extname(source) || ".txt"}`
}

async function referenceAbsolutePath(reference: DeliveryReference) {
  if (reference.absolutePath && (await Bun.file(reference.absolutePath).exists())) return reference.absolutePath
  const found = await Promise.all(
    (await reportRoots()).map(async (root) => {
      const candidate = path.join(root, reference.path)
      if (await Bun.file(candidate).exists()) return candidate
    }),
  )
  return found.find(Boolean)
}

async function packageFiles(dir: string, references: DeliveryReference[]) {
  await mkdir(dir, { recursive: true })
  return Promise.all(
    references.map(async (reference, index): Promise<WorkflowDeliveryFile> => {
      const source = await referenceAbsolutePath(reference)
      const target = path.join(dir, packageArtifactName(index, reference.path))
      if (source) await Bun.write(target, Bun.file(source))
      return {
        kind: "artifact",
        label: reference.label,
        path: path.relative(Instance.directory, target),
        absolutePath: target,
        sourcePath: reference.path,
        copied: Boolean(source),
      }
    }),
  )
}

function deliveryMarkdown(input: {
  delivery: WorkflowDeliveryArchive
  acceptance: WorkflowAcceptance
  references: DeliveryReference[]
  files: WorkflowDeliveryFile[]
}) {
  return [
    `# ${input.delivery.workflowName} 交付摘要`,
    "",
    `- 会话 ID: ${input.delivery.sessionId}`,
    `- 工作流 ID: ${input.delivery.workflowId}`,
    `- 交付包版本: ${input.delivery.version}`,
    `- 导出时间: ${input.delivery.generatedAt}`,
    `- 交付目录: ${input.delivery.directoryPath ?? "-"}`,
    `- Manifest: ${input.delivery.manifestPath ?? "-"}`,
    `- 包内文件数: ${input.delivery.fileCount ?? 0}`,
    "",
    "## 验收结论",
    "- 状态: 通过",
    `- 验收时间: ${input.acceptance.generatedAt}`,
    `- 会话消息数: ${input.acceptance.messageCount}`,
    "",
    "## 附件引用",
    ...(input.references.length
      ? input.references.map((item) => {
          const copy = input.files.find((file) => file.sourcePath === item.path)
          const packaged = copy?.copied ? `（包内副本: ${copy.path}）` : "（源文件未找到，未复制）"
          return `- ${item.label}: ${item.path}${packaged}`
        })
      : ["- 暂无已登记附件。"]),
    "",
    "## 交付包文件",
    "| 文件 | 类型 | 路径 |",
    "|---|---|---|",
    ...input.files.map(
      (item) => `| ${markdownCell(item.label)} | ${markdownCell(item.kind)} | ${markdownCell(item.path)} |`,
    ),
    "",
    "## 验收检查",
    "| 检查项 | 状态 | 说明 |",
    "|---|---|---|",
    ...input.acceptance.checks.map(
      (item) =>
        `| ${markdownCell(item.label)} | ${markdownCell(checkStatusLabel(item.status))} | ${markdownCell(item.detail)} |`,
    ),
    "",
  ].join("\n")
}

async function acceptance(input: { workflowId: string; sessionId: string }) {
  const workflow = presets.find((item) => item.id === input.workflowId)
  if (!workflow) throw new Error(`workflow "${input.workflowId}" not found`)
  const stored = await workflowSession(input.sessionId)
  const messages = await Session.messages({ sessionID: input.sessionId })
  const user = messages
    .filter((message) => message.info.role === "user")
    .map((message) => message.parts.map(partText).join("\n"))
    .join("\n")
  const assistant = messages
    .filter((message) => message.info.role === "assistant")
    .map((message) => message.parts.map(partText).join("\n").trim())
    .filter(Boolean)
  const final = assistant.at(-1) ?? ""
  const source = artifactPaths([user, ...assistant].join("\n"))
  const expected = {
    markdown: source.markdown,
    json: source.json,
  }
  const toolMarkers = ["sigma0", "残差", "warning", "样本", "格式", "自由网", "粗差", "稳健", "方差分量", "条件"]
  const present = toolMarkers.filter((marker) => final.includes(marker))
  const citation = /wiki_page_path|raw_source_md|norm_clause_id|tool_norm_cite|TB\d{4,}/.test(final)
  const checks = [
    item({
      id: "messages",
      label: "会话输出",
      status: final ? "ok" : "fail",
      detail: final ? `检测到 ${assistant.length} 条助手输出` : "尚未检测到助手最终输出",
    }),
    item({
      id: "artifacts",
      label: "附件引用",
      status: includesAll(final, expected.markdown) && includesAll(final, expected.json) ? "ok" : "fail",
      detail:
        expected.markdown.length && expected.json.length
          ? `Markdown ${expected.markdown.length} 个，JSON ${expected.json.length} 个；最终输出${includesAll(final, expected.markdown) && includesAll(final, expected.json) ? "已逐字引用" : "缺少逐字引用"}`
          : "未在会话中找到格式覆盖 Markdown/JSON 附件路径",
    }),
    item({
      id: "artifact-section",
      label: "附件小节",
      status: final.includes("附件引用") && final.includes("格式兼容性质检报告") ? "ok" : "fail",
      detail: final.includes("附件引用") ? "包含附件引用小节" : "缺少「附件引用」小节",
    }),
    item({
      id: "norm-citation",
      label: "规范引用",
      status: citation ? "ok" : "fail",
      detail: citation
        ? "包含规范引用标记或 TB 标准编号"
        : "缺少 wiki_page_path/raw_source_md/norm_clause_id 或 TB 标准编号",
    }),
    item({
      id: "tool-summary",
      label: "工具结果摘要",
      status: present.length >= 5 ? "ok" : "fail",
      detail: `命中 ${present.length}/${toolMarkers.length} 个摘要标记：${present.join("、") || "无"}`,
    }),
  ]
  const result = {
    workflowId: workflow.id,
    sessionId: input.sessionId,
    ok: checks.every((check) => check.status !== "fail"),
    generatedAt: new Date().toISOString(),
    messageCount: messages.length,
    checks,
  }
  await saveWorkflowSession({
    sessionId: input.sessionId,
    workflowId: workflow.id,
    workflowName: workflow.name,
    acceptance: result,
  })
  const durationMs = stored ? Math.max(0, Date.parse(result.generatedAt) - Date.parse(stored.createdAt)) : 0
  if (result.ok)
    await Bus.publish(WorkflowCompleted, {
      workflowId: workflow.id,
      sessionId: input.sessionId,
      durationMs,
    })
  return result
}

async function archiveDelivery(input: { workflowId: string; sessionId: string }) {
  const workflow = presets.find((item) => item.id === input.workflowId)
  if (!workflow) return { status: 400 as const, error: `workflow "${input.workflowId}" not found` }
  const stored = await workflowSession(input.sessionId)
  const result = stored?.acceptance?.workflowId === input.workflowId ? stored.acceptance : await acceptance(input)
  if (!result.ok) return { status: 400 as const, error: "workflow acceptance must pass before archive" }

  const current = (await workflowSession(input.sessionId)) ?? stored
  const source = await sessionText(input.sessionId)
  const dir = workflowDeliveryPackageDir(input.sessionId)
  const file = workflowDeliveryPath(input.sessionId)
  const manifest = workflowDeliveryManifestPath(input.sessionId)
  const references = deliveryReferences(current?.artifacts ?? [], source)
  const artifacts = await packageFiles(dir, references)
  const summary: WorkflowDeliveryFile = {
    kind: "summary",
    label: "交付摘要 Markdown",
    path: path.relative(Instance.directory, file),
    absolutePath: file,
    copied: true,
  }
  const manifestFile: WorkflowDeliveryFile = {
    kind: "manifest",
    label: "交付清单 JSON",
    path: path.relative(Instance.directory, manifest),
    absolutePath: manifest,
    copied: true,
  }
  const files = [summary, ...artifacts, manifestFile]
  const delivery: WorkflowDeliveryArchive = {
    sessionId: input.sessionId,
    workflowId: workflow.id,
    workflowName: current?.workflowName ?? workflow.name,
    version: WORKFLOW_DELIVERY_PACKAGE_VERSION,
    generatedAt: new Date().toISOString(),
    directoryPath: path.relative(Instance.directory, dir),
    absoluteDirectoryPath: dir,
    markdownPath: summary.path,
    absoluteMarkdownPath: file,
    manifestPath: manifestFile.path,
    absoluteManifestPath: manifest,
    fileCount: files.filter((item) => item.copied).length,
    files,
  }
  await Bun.write(
    file,
    deliveryMarkdown({
      delivery,
      acceptance: result,
      references,
      files,
    }),
  )
  await Bun.write(
    manifest,
    `${JSON.stringify(
      WorkflowDeliveryManifestSchema.parse({
        kind: WORKFLOW_DELIVERY_MANIFEST_KIND,
        version: WORKFLOW_DELIVERY_MANIFEST_VERSION,
        delivery,
        acceptance: result,
        references,
      }),
      null,
      2,
    )}\n`,
  )
  await saveWorkflowSession({
    sessionId: input.sessionId,
    workflowId: workflow.id,
    workflowName: current?.workflowName ?? workflow.name,
    artifacts: current?.artifacts,
    acceptance: result,
    delivery,
  })
  return delivery
}

export const AgentStudioRoutes = lazy(() => {
  const schema = {
    list: Agent.Info.extend({
      displayName: z.string().optional().meta({
        description: "Localized product-facing name for Agent Studio.",
      }),
      filePath: z.string().optional().meta({
        description: "Absolute path of the backing .md file.",
      }),
      callCount7d: z.number().int().optional().meta({
        description: "Message count by this agent in the last 7 days.",
      }),
    }).meta({ ref: "AgentListItem" }),
    detail: Agent.Info.extend({
      displayName: z.string().optional(),
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
        description: "Returns tools grouped for the Agent Studio capability inventory.",
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
        description: "Returns skills discovered from workspace and global skill directories.",
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
      "/wiki/status",
      describeRoute({
        summary: "Get norm Wiki status",
        description: "Returns current norm library counts and recent change or quality reports.",
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
      "/format/report",
      describeRoute({
        summary: "Get format sample coverage report",
        description:
          "Runs the built-in survey format sample corpus, writes Markdown/JSON quality attachments, and returns parser readiness diagnostics.",
        operationId: "agentStudio.format.report",
        responses: {
          200: {
            description: "Format sample coverage report",
            content: {
              "application/json": {
                schema: resolver(FormatCoverageReportSchema),
              },
            },
          },
        },
      }),
      async (c) => c.json(await formatReport()),
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
      "/workflow/session/:sessionId",
      describeRoute({
        summary: "Get workflow session metadata",
        description: "Returns persisted workflow artifacts and the latest delivery acceptance result for a session.",
        operationId: "agentStudio.workflow.session",
        responses: {
          200: {
            description: "Workflow session metadata",
            content: {
              "application/json": {
                schema: resolver(WorkflowSessionSchema),
              },
            },
          },
          ...errors(404),
        },
      }),
      validator(
        "param",
        z.object({
          sessionId: z.string(),
        }),
      ),
      async (c) => {
        const info = await workflowSession(c.req.valid("param").sessionId)
        if (!info) return c.json({ error: "workflow session not found" }, 404)
        return c.json(info)
      },
    )
    .post(
      "/workflow/acceptance",
      describeRoute({
        summary: "Check workflow delivery acceptance",
        description: "Validates a completed session against workflow-specific delivery requirements.",
        operationId: "agentStudio.workflow.acceptance",
        responses: {
          200: {
            description: "Workflow delivery acceptance result",
            content: {
              "application/json": {
                schema: resolver(WorkflowAcceptanceSchema),
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
          sessionId: z.string(),
        }),
      ),
      async (c) => {
        const body = c.req.valid("json")
        const workflow = presets.find((item) => item.id === body.workflowId)
        if (!workflow) return c.json({ error: `workflow "${body.workflowId}" not found` }, 400)
        return c.json(await acceptance(body))
      },
    )
    .post(
      "/workflow/delivery/archive",
      describeRoute({
        summary: "Archive accepted workflow delivery",
        description: "Writes a local Markdown delivery summary for a workflow session that has passed acceptance.",
        operationId: "agentStudio.workflow.delivery.archive",
        responses: {
          200: {
            description: "Workflow delivery archive",
            content: {
              "application/json": {
                schema: resolver(WorkflowDeliveryArchiveSchema),
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
          sessionId: z.string(),
        }),
      ),
      async (c) => {
        const result = await archiveDelivery(c.req.valid("json"))
        if ("error" in result) return c.json({ error: result.error }, result.status)
        return c.json(result)
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
        const artifacts = await runArtifacts(workflow)
        const text = prompt(workflow, body.input, artifacts)
        await saveWorkflowSession({
          sessionId: session.id,
          workflowId: workflow.id,
          workflowName: workflow.name,
          artifacts,
        })
        return c.json({
          sessionId: session.id,
          sessionTitle: title,
          workflowId: workflow.id,
          directory: Instance.directory,
          prompt: text,
          agentNames: [...new Set(workflow.nodes.map((node) => node.agent))],
          artifacts,
        })
      },
    )
})
