import { base64Encode } from "@railwise/util/encode"
import type { AgentStudioItem, SkillInventoryItem, ToolInventoryItem } from "@/types/agent-studio"
import type { Workflow } from "@/types/workflow"
import { removeScalar, setScalar } from "@/utils/agent-markdown"

export const recommendedModel = "DeepSeek V4"
export const recommendedProviders = [
  { id: "deepseek", label: "DeepSeek" },
  { id: "openrouter", label: "OpenRouter" },
] as const

export type CollaborationDraft = {
  directory: string
  agent: string
  prompt: string
}

type WorkspaceProject = {
  worktree: string
  time: {
    created: number
    updated?: number
  }
}

type Agent = {
  name: string
  mode: "subagent" | "primary" | "all"
  hidden?: boolean
  model?: {
    providerID: string
    modelID: string
  }
}

type Skill = {
  name: string
  description: string
  location: string
}

const skills = [
  "rail-monitoring-plan",
  "operational-monitoring",
  "monitoring-design",
  "data-analysis",
  "standard-reference",
  "report-writing",
  "excel-operations",
  "docx-generation",
  "canvas-design",
  "bidding-knowledge",
  "humanizer",
  "frontend-design",
]

export const builtinAgents: AgentStudioItem[] = [
  {
    name: "chief_manager",
    displayName: "总工程师",
    description: "负责需求澄清、任务拆解、智能体调度、质量闸门和最终汇总。",
    mode: "primary",
    native: true,
    color: "#8B5E22",
    permission: {},
    options: {},
  },
  {
    name: "solution_architect",
    displayName: "方案总设",
    description: "负责监测方案、仪器选型、测点布设和技术路线规划。",
    mode: "subagent",
    native: true,
    color: "#2563EB",
    permission: {},
    options: {},
  },
  {
    name: "qa_inspector",
    displayName: "外业质检",
    description: "负责外业原始数据完整性、限差和闭合差首检。",
    mode: "subagent",
    native: true,
    color: "#0F766E",
    permission: {},
    options: {},
  },
  {
    name: "adjustment_computer",
    displayName: "平差计算",
    description: "负责水准网、导线网、平面控制网和 CPIII 严密计算。",
    mode: "subagent",
    native: true,
    color: "#6D28D9",
    permission: {},
    options: {},
  },
  {
    name: "data_analyst",
    displayName: "监测分析",
    description: "负责测绘数据处理、变形趋势分析和预警研判。",
    mode: "subagent",
    native: true,
    color: "#7C2D12",
    permission: {},
    options: {},
  },
  {
    name: "norm_librarian",
    displayName: "规范资料",
    description: "负责规范条文查询、引用固化和规范 Wiki 维护。",
    mode: "subagent",
    native: true,
    color: "#115E59",
    permission: {},
    options: {},
  },
  {
    name: "technical_writer",
    displayName: "报告编制",
    description: "负责监测日报、周报、总结报告和投标技术文件成稿。",
    mode: "subagent",
    native: true,
    color: "#15803D",
    permission: {},
    options: {},
  },
  {
    name: "qa_reviewer",
    displayName: "总工复核",
    description: "负责技术方案和报告的规范合规终审，拥有质量否决权。",
    mode: "subagent",
    native: true,
    color: "#B91C1C",
    permission: {},
    options: {},
  },
  {
    name: "source_ingestor",
    displayName: "资料入库",
    description: "负责规范 PDF、甲方文件、监测台账和历史成果的结构化交接。",
    mode: "subagent",
    native: true,
    color: "#0369A1",
    permission: {},
    options: {},
  },
  {
    name: "knowledge_curator",
    displayName: "知识沉淀",
    description: "负责项目案例、FAQ、复盘经验和企业知识库维护。",
    mode: "subagent",
    native: true,
    color: "#4D7C0F",
    permission: {},
    options: {},
  },
  {
    name: "cpiii_specialist",
    displayName: "CPIII 专家",
    description: "负责高速铁路和城轨 CPIII 精测网复测方案与成果审查。",
    mode: "subagent",
    native: true,
    color: "#7C3AED",
    permission: {},
    options: {},
  },
  {
    name: "commercial_specialist",
    displayName: "商务投标",
    description: "负责商务报价、标书资质响应、合同审核与结算收款。",
    mode: "subagent",
    native: true,
    color: "#C2410C",
    permission: {},
    options: {},
  },
]

export const builtinTools: ToolInventoryItem[] = [
  { id: "task", label: "智能体任务调度", group: "agent" },
  { id: "skill", label: "专业技能加载", group: "agent" },
  { id: "standard_query_query_standard", label: "规范条文查询", group: "knowledge" },
  { id: "standard_query_list_standards", label: "规范库清单", group: "knowledge" },
  { id: "tool_wiki_ingest", label: "规范资料入库", group: "knowledge" },
  { id: "format_parser", label: "仪器原始格式解析", group: "survey" },
  { id: "monitoring_csv", label: "监测 CSV 清洗分析", group: "survey" },
  { id: "survey_calculator_leveling_closure", label: "水准闭合差检核", group: "survey" },
  { id: "survey_calculator_leveling_adjustment", label: "水准网严密平差", group: "survey" },
  { id: "survey_calculator_traverse_closure", label: "导线闭合差检核", group: "survey" },
  { id: "survey_calculator_traverse_adjustment", label: "导线网严密平差", group: "survey" },
  { id: "control_network_plane_network_adjustment", label: "平面控制网平差", group: "survey" },
  { id: "cpiii_adjustment_free_station_resection", label: "自由设站后方交会", group: "survey" },
  { id: "cpiii_adjustment_cpiii_network_adjustment", label: "CPIII 控制网平差", group: "survey" },
  { id: "chart_generator", label: "监测趋势图生成", group: "survey" },
  { id: "report_export", label: "Word 成果报告导出", group: "survey" },
  { id: "excel_export_monitoring_table_export", label: "监测数据表导出", group: "survey" },
  { id: "bash", label: "本地命令执行", group: "core" },
  { id: "read", label: "文件读取", group: "core" },
  { id: "glob", label: "目录扫描", group: "core" },
  { id: "grep", label: "文本检索", group: "core" },
  { id: "apply_patch", label: "文件补丁修改", group: "core" },
  { id: "mcp", label: "MCP 外部连接器", group: "extension" },
]

export const builtinSkills: SkillInventoryItem[] = [
  { name: "rail-monitoring-plan", description: "轨道交通控制保护区监测方案编制、内审、专家评审与修订。", location: "packages/railwise/skill/rail-monitoring-plan/SKILL.md" },
  { name: "operational-monitoring", description: "运营期结构长期变形监测作业、期报、年报、预警处置与资料归档。", location: "packages/railwise/skill/operational-monitoring/SKILL.md" },
  { name: "monitoring-design", description: "工程监测方案设计、测点布设、报警值和监测频率设计。", location: "packages/railwise/skill/monitoring-design/SKILL.md" },
  { name: "data-analysis", description: "测绘数据平差、变形趋势分析和异常判断。", location: "packages/railwise/skill/data-analysis/SKILL.md" },
  { name: "standard-reference", description: "工程监测规范条文速查、引用固化和合规核查。", location: "packages/railwise/skill/standard-reference/SKILL.md" },
  { name: "report-writing", description: "监测日报、周报、总结报告和投标技术文件写作。", location: "packages/railwise/skill/report-writing/SKILL.md" },
  { name: "excel-operations", description: "监测数据表、统计汇总表和多期对比表生成。", location: "packages/railwise/skill/excel-operations/SKILL.md" },
  { name: "docx-generation", description: "将监测报告、技术方案和投标文件导出为正式 Word 文档。", location: "packages/railwise/skill/docx-generation/SKILL.md" },
  { name: "canvas-design", description: "生成监测趋势图、断面剖面图、测点分布示意图和工程图表。", location: "packages/railwise/skill/canvas-design/SKILL.md" },
  { name: "bidding-knowledge", description: "工程监测招投标评分、报价策略、资质响应和合同风险知识库。", location: "packages/railwise/skill/bidding-knowledge/SKILL.md" },
  { name: "doc-coauthoring", description: "结构化协同起草方案、报告、纪要、PRD 和评审材料。", location: "packages/railwise/skill/doc-coauthoring/SKILL.md" },
  { name: "docx", description: "读取、创建、编辑和导出 Word 文档。", location: "packages/railwise/skill/docx/SKILL.md" },
  { name: "xlsx", description: "读取、清洗、编辑和生成 Excel/CSV 表格。", location: "packages/railwise/skill/xlsx/SKILL.md" },
  { name: "pptx", description: "创建、解析、编辑和导出 PowerPoint 演示文稿。", location: "packages/railwise/skill/pptx/SKILL.md" },
  { name: "pdf", description: "读取、解析、转换和处理 PDF 文件。", location: "packages/railwise/skill/pdf/SKILL.md" },
  { name: "web-artifacts-builder", description: "构建可交互的 Web 报告、看板和前端交付物。", location: "packages/railwise/skill/web-artifacts-builder/SKILL.md" },
  { name: "webapp-testing", description: "使用 Playwright 测试本地 Web 应用、截图和排查前端问题。", location: "packages/railwise/skill/webapp-testing/SKILL.md" },
  { name: "mcp-builder", description: "创建和配置 MCP 服务器与外部工具连接。", location: "packages/railwise/skill/mcp-builder/SKILL.md" },
  { name: "skill-creator", description: "创建、优化和评估可复用专业技能。", location: "packages/railwise/skill/skill-creator/SKILL.md" },
  { name: "brand-guidelines", description: "应用品牌视觉规范、色彩和排版。", location: "packages/railwise/skill/brand-guidelines/SKILL.md" },
  { name: "theme-factory", description: "为报告、PPT 和 HTML 产物生成统一主题。", location: "packages/railwise/skill/theme-factory/SKILL.md" },
  { name: "humanizer", description: "将机械文本润色为更自然的工程表达。", location: "packages/railwise/skill/humanizer/SKILL.md" },
  { name: "frontend-design", description: "设计和实现高质量前端界面。", location: "packages/railwise/skill/frontend-design/SKILL.md" },
]

export const builtinWorkflows: Workflow[] = [
  {
    id: "monitoring-report-pipeline",
    name: "监测报告流水线",
    description: "外业首检、趋势分析、报告编制和总工复核。",
    nodes: [
      { id: "chief", agent: "chief_manager", label: "任务拆解", color: "#8B5E22", x: 20, y: 40 },
      { id: "qa", agent: "qa_inspector", label: "外业首检", color: "#0F766E", x: 240, y: 120 },
      { id: "analysis", agent: "data_analyst", label: "趋势分析", color: "#7C2D12", x: 460, y: 120 },
      { id: "writer", agent: "technical_writer", label: "报告成稿", color: "#15803D", x: 680, y: 40 },
      { id: "review", agent: "qa_reviewer", label: "总工复核", color: "#B91C1C", x: 900, y: 40 },
    ],
    edges: [
      { from: "chief", to: "qa", kind: "serial", label: "首检" },
      { from: "qa", to: "analysis", kind: "serial", label: "放行" },
      { from: "analysis", to: "writer", kind: "serial", label: "成稿" },
      { from: "writer", to: "review", kind: "serial", label: "终审" },
    ],
  },
  {
    id: "rail-protection-plan",
    name: "地铁保护区方案",
    description: "资料清点、方案设计、规范引用、报告编制和审校闭环。",
    nodes: [
      { id: "source", agent: "source_ingestor", label: "资料清点", color: "#0369A1", x: 20, y: 120 },
      { id: "solution", agent: "solution_architect", label: "方案设计", color: "#2563EB", x: 240, y: 40 },
      { id: "norm", agent: "norm_librarian", label: "规范依据", color: "#115E59", x: 240, y: 200 },
      { id: "writer", agent: "technical_writer", label: "方案成稿", color: "#15803D", x: 480, y: 120 },
      { id: "review", agent: "qa_reviewer", label: "总工复核", color: "#B91C1C", x: 700, y: 120 },
    ],
    edges: [
      { from: "source", to: "solution", kind: "parallel", label: "资料" },
      { from: "source", to: "norm", kind: "parallel", label: "规范" },
      { from: "solution", to: "writer", kind: "serial", label: "草案" },
      { from: "norm", to: "writer", kind: "serial", label: "依据" },
      { from: "writer", to: "review", kind: "serial", label: "审校" },
    ],
  },
  {
    id: "cpiii-remeasurement",
    name: "CPIII 复测成果链",
    description: "控制网资料、外业组织、严密平差、规范固化和成果审查。",
    nodes: [
      { id: "source", agent: "source_ingestor", label: "成果资料", color: "#0369A1", x: 20, y: 120 },
      { id: "cpiii", agent: "cpiii_specialist", label: "作业方案", color: "#7C3AED", x: 240, y: 40 },
      { id: "calc", agent: "adjustment_computer", label: "严密平差", color: "#6D28D9", x: 460, y: 120 },
      { id: "norm", agent: "norm_librarian", label: "规范固化", color: "#115E59", x: 240, y: 200 },
      { id: "review", agent: "qa_reviewer", label: "成果审查", color: "#B91C1C", x: 680, y: 120 },
    ],
    edges: [
      { from: "source", to: "cpiii", kind: "parallel", label: "输入" },
      { from: "source", to: "norm", kind: "parallel", label: "依据" },
      { from: "cpiii", to: "calc", kind: "serial", label: "观测" },
      { from: "calc", to: "review", kind: "serial", label: "成果" },
      { from: "norm", to: "review", kind: "serial", label: "合规" },
    ],
  },
]

export function agentDisplayName(agent: Pick<Agent, "name"> & { displayName?: string }) {
  if (agent.displayName) return agent.displayName
  return builtinAgents.find((item) => item.name === agent.name)?.displayName ?? agent.name
}

export function agentRoleLabel(agent: Agent) {
  if (agent.mode === "primary") return "公司总工"
  return "专业智能体"
}

export function agentStudioSummary(agents: Agent[]) {
  const visible = agents.filter((agent) => !agent.hidden)
  const primary = visible.filter((agent) => agent.mode === "primary").length
  return {
    total: visible.length,
    primary,
    collaborators: visible.length - primary,
  }
}

function normalizeDirectory(value: string) {
  const clean = value.trim().replaceAll("\\", "/")
  if (clean === "/") return clean
  if (/^[A-Za-z]:\/$/.test(clean)) return clean
  return clean.replace(/\/+$/, "")
}

export function recentWorkspaces(projects: WorkspaceProject[], limit = 4) {
  const seen = new Set<string>()
  return projects
    .map((project) => ({
      ...project,
      worktree: normalizeDirectory(project.worktree),
    }))
    .filter((project) => project.worktree && project.worktree !== "/")
    .sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
    .filter((project) => {
      if (seen.has(project.worktree)) return false
      seen.add(project.worktree)
      return true
    })
    .slice(0, limit)
}

function skillRank(skill: Skill) {
  const index = skills.indexOf(skill.name)
  if (index >= 0) return index
  if (skill.location.includes("/.railwise/skill/")) return skills.length
  return skills.length + 1
}

export function professionalSkills(list: Skill[], limit = 12) {
  return list
    .slice()
    .sort((a, b) => skillRank(a) - skillRank(b) || a.name.localeCompare(b.name, "zh-Hans-CN"))
    .slice(0, limit)
}

export function collaborationTarget(input: CollaborationDraft) {
  const directory = normalizeDirectory(input.directory)
  const key = base64Encode(directory)
  const agent = input.agent.trim()
  const prompt = input.prompt.trim()

  return {
    agent,
    directory,
    key,
    href: `/${key}/session`,
    prompt: agent ? `@${agent}\n${prompt}` : prompt,
  }
}

export function modelRouteLabel(agent: Agent, fallback = recommendedModel) {
  if (agent.model) return `${agent.model.providerID}/${agent.model.modelID}`
  return `默认 ${fallback}`
}

export function modelRoutingSummary(agents: Agent[]) {
  const visible = agents.filter((agent) => !agent.hidden)
  const bound = visible.filter((agent) => Boolean(agent.model)).length
  return {
    total: visible.length,
    bound,
    defaulted: visible.length - bound,
    recommended: recommendedModel,
  }
}

export function modelSetupState(input: { connectedProviders: number; visibleModels: number }) {
  if (input.visibleModels > 0) return "ready" as const
  if (input.connectedProviders > 0) return "models-hidden" as const
  return "needs-provider" as const
}

export function parseModelRoute(value: string) {
  const route = value.trim()
  const index = route.indexOf("/")
  if (index <= 0 || index === route.length - 1) return
  return {
    providerID: route.slice(0, index),
    modelID: route.slice(index + 1),
  }
}

export function updateAgentModelRoute(raw: string, value: string) {
  const route = value.trim()
  if (!route) return removeScalar(raw, "model")
  return setScalar(raw, "model", route)
}
