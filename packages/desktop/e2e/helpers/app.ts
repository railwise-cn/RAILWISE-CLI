import { expect, test as base, type BrowserContext, type Page, type Route } from "@playwright/test"

type WorkspaceFile = {
  path: string
  kind: "csv" | "dxf" | "pptx" | "md"
  content?: string
}

type Project = {
  id?: string
  worktree: string
  vcs?: "git"
  time: {
    created: number
    updated?: number
  }
}

type LaunchOptions = {
  model?: "configured"
  projects?: Project[]
  emptySessions?: boolean
  workspaceFiles?: WorkspaceFile[]
  toolFailure?: boolean
  permission?: "none"
}

type Fixtures = {
  launchApp: (path?: string, opts?: LaunchOptions) => Promise<{ page: Page; context: BrowserContext }>
}

const server = "http://127.0.0.1:4096"
const csv = "点号,里程,沉降(mm),状态\nJC-001,K12+100,-1.2,正常\nJC-002,K12+180,-6.4,预警\n"
const dxf = {
  sourcePath: "/tmp/sample-survey.dxf",
  layers: [
    { name: "CONTROL", color: 2, visible: true },
    { name: "MONITOR", color: 5, visible: true },
  ],
  entities: [
    { kind: "line", id: "l1", layer: "CONTROL", color: 2, start: { x: 0, y: 0 }, end: { x: 100, y: 0 } },
    { kind: "circle", id: "c1", layer: "MONITOR", color: 5, center: { x: 50, y: 30 }, radius: 8 },
  ],
  bounds: { minX: -10, minY: -10, maxX: 120, maxY: 80 },
  totalEntityCount: 2,
}

const agents = [
  {
    name: "chief_manager",
    description: "统筹测绘项目、拆解任务并调度专业智能体。",
    mode: "primary",
    permission: {},
    options: {},
    prompt: "你负责理解任务、拆解步骤，并按需要调度专业智能体与工具。",
  },
  {
    name: "qa_inspector",
    description: "负责外业数据首检、异常检测与质量报告。",
    mode: "subagent",
    permission: {},
    options: {},
    prompt: "你是外业数据质检员。",
  },
]

const read = { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false } as const
const write = { filesystem: "write", network: false, shell: false, external_directory: false, secrets: false } as const

const toolCatalog = [
  {
    id: "task",
    name: "智能体任务调度",
    description: "把用户任务分派给任务调度与专业智能体，并汇总执行结果。",
    group: "agent",
    tags: ["智能体", "调度", "协作"],
    permissions: read,
  },
  {
    id: "skill",
    name: "Skill 加载器",
    description: "按任务加载专业 Skill，让智能体获得对应作业流程和检查清单。",
    group: "agent",
    tags: ["Skill", "加载", "流程"],
    permissions: read,
  },
  {
    id: "file_reader",
    name: "本地文件读取",
    description: "读取当前工作区内的工程文件。",
    group: "core",
    tags: ["文件", "本地", "工作区"],
    permissions: read,
  },
  {
    id: "standard_query_query_standard",
    name: "规范条文查询",
    description: "检索工程测绘、轨道交通监测和成果交付相关规范条文。",
    group: "knowledge",
    tags: ["规范", "条文", "检索"],
    permissions: read,
  },
  {
    id: "survey_calculator_leveling_closure",
    name: "水准闭合差检核",
    description: "对水准路线闭合差、限差和观测成果进行快速复核。",
    group: "survey",
    tags: ["水准", "闭合差", "复核"],
    permissions: read,
  },
  {
    id: "resurvey_material_check",
    name: "复测资料检查",
    description: "检查复测资料目录、控制点成果、观测记录和缺失文件。",
    group: "survey",
    tags: ["复测", "资料", "缺失"],
    permissions: read,
  },
  {
    id: "monitoring_data_first_check",
    name: "监测数据首检",
    description: "对沉降、位移、收敛等监测数据进行异常点和预警状态初筛。",
    group: "survey",
    tags: ["监测", "异常", "预警"],
    permissions: read,
  },
  {
    id: "dxf_layer_inspector",
    name: "DXF 图层检查",
    description: "检查 CAD/DXF 图层命名、关键构筑物线型和成果图交付完整性。",
    group: "survey",
    tags: ["DXF", "CAD", "图层"],
    permissions: read,
  },
  {
    id: "xlsx_quality_checker",
    name: "Excel 表格校验",
    description: "检查 XLSX/CSV 表格字段、空值、单位、阈值和统计结果。",
    group: "survey",
    tags: ["Excel", "CSV", "校验"],
    permissions: read,
  },
  {
    id: "docx_report_formatter",
    name: "Word 成果排版",
    description: "检查并整理 Word 成果报告结构、目录、表格和交付格式。",
    group: "extension",
    tags: ["Word", "报告", "排版"],
    permissions: write,
  },
  {
    id: "pptx_brief_builder",
    name: "PPT 汇报生成",
    description: "基于项目阶段、数据结论和风险提示生成汇报幻灯片。",
    group: "extension",
    tags: ["PPT", "汇报", "生成"],
    permissions: write,
  },
  {
    id: "pdf_form_checker",
    name: "PDF 表单检查",
    description: "提取并检查 PDF 表单、签章页和资料归档信息。",
    group: "extension",
    tags: ["PDF", "表单", "归档"],
    permissions: read,
  },
] as const

const tools = toolCatalog.map((item) => ({ id: item.id, label: item.name, group: item.group }))

const skillCatalog = [
  {
    id: "rail-monitoring-plan",
    name: "轨道交通监测方案",
    description: "编制轨道交通控制保护区、地保监测和专家评审方案。",
    tags: ["轨道交通", "监测", "方案"],
    permissions: read,
  },
  {
    id: "monitoring-design",
    name: "工程监测方案设计",
    description: "工程监测方案设计",
    tags: ["测绘", "监测", "方案"],
    permissions: read,
  },
  {
    id: "operational-monitoring",
    name: "运营期监测",
    description: "处理运营期沉降、水平位移、收敛和预警处置等监测资料。",
    tags: ["运营期", "监测", "预警"],
    permissions: write,
  },
  {
    id: "data-analysis",
    name: "测绘数据分析",
    description: "测绘数据平差与变形分析",
    tags: ["数据分析", "平差", "复核"],
    permissions: read,
  },
  {
    id: "standard-reference",
    name: "规范条文速查",
    description: "规范条文速查",
    tags: ["规范", "条文", "依据"],
    permissions: read,
  },
  {
    id: "report-writing",
    name: "成果报告写作",
    description: "生成测绘、监测、复测和阶段汇报类成果报告初稿，并进行技术审校。",
    tags: ["报告", "审校", "交付"],
    permissions: write,
  },
  {
    id: "excel-operations",
    name: "表格数据处理",
    description: "整理 Excel 数据表、计算检查项、生成统计结果和可交付表格。",
    tags: ["Excel", "表格", "统计"],
    permissions: write,
  },
  {
    id: "docx-generation",
    name: "Word 成果生成",
    description: "生成 Word 成果文档、套用模板并整理报告结构。",
    tags: ["Word", "报告", "模板"],
    permissions: write,
  },
  {
    id: "docx",
    name: "DOCX 文件处理",
    description: "读取、编辑和生成 Word 文档，支持目录、页眉页脚、表格和模板。",
    tags: ["DOCX", "Word", "文件"],
    permissions: write,
  },
  {
    id: "pptx",
    name: "PPT 汇报生成",
    description: "根据项目阶段、数据结论和交付对象生成汇报幻灯片。",
    tags: ["PPT", "汇报", "演示"],
    permissions: write,
  },
  {
    id: "pdf",
    name: "PDF 表单与检查",
    description: "检查 PDF 表单、提取结构信息并辅助生成带注释的 PDF 交付材料。",
    tags: ["PDF", "表单", "检查"],
    permissions: write,
  },
  {
    id: "xlsx",
    name: "XLSX 文件处理",
    description: "读取、校验和生成 XLSX 工作簿，用于工程数据统计与交付。",
    tags: ["XLSX", "表格", "交付"],
    permissions: write,
  },
  {
    id: "bidding-knowledge",
    name: "投标资料知识库",
    description: "整理招投标资料、资质响应、技术方案和商务材料检查清单。",
    tags: ["投标", "资料", "知识库"],
    permissions: read,
  },
  {
    id: "frontend-design",
    name: "工程前端设计",
    description: "为监测平台、数据看板和内部管理系统生成工程行业 UI 方案。",
    tags: ["前端", "设计", "看板"],
    permissions: read,
  },
  {
    id: "canvas-design",
    name: "可视化设计",
    description: "制作项目展示、成果图示、汇报版式和可视化素材。",
    tags: ["设计", "可视化", "汇报"],
    permissions: write,
  },
  {
    id: "humanizer",
    name: "文稿润色",
    description: "优化技术报告、投标文本和汇报材料的表达，使其更自然、专业。",
    tags: ["润色", "文稿", "审校"],
    permissions: read,
  },
  {
    id: "doc-coauthoring",
    name: "文档协同审阅",
    description: "围绕多人协作场景进行文档审阅、修改建议和版本意见整理。",
    tags: ["协同", "审阅", "文档"],
    permissions: write,
  },
  {
    id: "internal-comms",
    name: "内部沟通写作",
    description: "编写项目进展、领导汇报、FAQ、事故说明和团队沟通材料。",
    tags: ["沟通", "汇报", "文档"],
    permissions: read,
  },
  {
    id: "brand-guidelines",
    name: "品牌规范参考",
    description: "在文档、演示和页面中套用统一的品牌色、字体和视觉规范。",
    tags: ["品牌", "视觉", "规范"],
    permissions: read,
  },
  {
    id: "theme-factory",
    name: "主题样式工厂",
    description: "为报告、网页、幻灯片和设计稿生成一致的配色与字体主题。",
    tags: ["主题", "样式", "设计"],
    permissions: read,
  },
  {
    id: "web-artifacts-builder",
    name: "Web Artifact 构建",
    description: "构建复杂 HTML/React 交互原型、报告页面和可视化组件。",
    tags: ["Web", "Artifact", "React"],
    permissions: write,
  },
  {
    id: "webapp-testing",
    name: "Web 应用测试",
    description: "使用 Playwright 调试本地 Web 应用、验证 UI 行为并采集截图。",
    tags: ["测试", "Playwright", "前端"],
    permissions: read,
  },
  {
    id: "bun-file-io",
    name: "Bun 文件读写",
    description: "提供 Bun 文件读写、扫描和目录处理的工程实现规范。",
    tags: ["Bun", "文件", "开发"],
    permissions: read,
  },
  {
    id: "mcp-builder",
    name: "MCP 服务构建",
    description: "设计和实现高质量 MCP Server，连接外部服务和企业能力。",
    tags: ["MCP", "工具", "集成"],
    permissions: write,
  },
  {
    id: "skill-creator",
    name: "Skill 创建器",
    description: "创建、改进和评测新的 Skill，并优化触发描述与执行流程。",
    tags: ["Skill", "创建", "评测"],
    permissions: write,
  },
  {
    id: "claude-api",
    name: "Claude API 开发",
    description: "构建、调试和优化 Claude API / Anthropic SDK 应用。",
    tags: ["Claude", "API", "开发"],
    permissions: read,
  },
  {
    id: "algorithmic-art",
    name: "算法艺术生成",
    description: "使用 p5.js、随机种子和交互参数生成原创算法艺术。",
    tags: ["艺术", "p5.js", "生成"],
    permissions: write,
  },
  {
    id: "slack-gif-creator",
    name: "Slack GIF 生成",
    description: "生成适合 Slack 使用的动画 GIF，并控制尺寸、帧率和文件大小。",
    tags: ["GIF", "Slack", "动画"],
    permissions: write,
  },
]

const skills = skillCatalog.map((item) => ({
  name: item.id,
  description: item.name,
  location: `/tmp/railwise-e2e/.railwise/skill/${item.id}/SKILL.md`,
}))

const workflow = {
  id: "monitor-pipeline",
  name: "监测报告流水线",
  description: "外业数据首检、趋势分析、报告生成与审校。",
  nodes: [
    { id: "a", agent: "chief_manager", label: "任务拆解", color: "#755620", x: 20, y: 40 },
    { id: "b", agent: "qa_inspector", label: "数据首检", color: "#8a6a34", x: 240, y: 120 },
    { id: "c", agent: "writer", label: "报告生成", color: "#5f4618", x: 480, y: 40 },
  ],
  edges: [
    { from: "a", to: "b", kind: "serial", label: "首检" },
    { from: "b", to: "c", kind: "serial", label: "成稿" },
  ],
}

const templates = [
  {
    id: "project-ppt",
    name: "项目汇报 PPT",
    category: "ppt",
    description: "生成工程项目阶段汇报幻灯片。",
    agent: "ppt_master",
    prompt: "请为 {{项目名称}} 生成汇报 PPT。",
    variables: [
      { key: "项目名称", label: "项目名称", type: "text", required: true },
      { key: "汇报对象", label: "汇报对象", type: "text", required: true },
      { key: "项目阶段", label: "项目阶段", type: "select", required: true, options: ["前期踏勘", "成果提交"] },
    ],
  },
]

const queueSession = {
  id: "queue-e2e",
  slug: "queue-e2e",
  projectID: "railwise-e2e",
  directory: "/tmp/railwise-e2e/worktree",
  title: "运营期监测预警复核",
  version: "e2e",
  time: { created: Date.now(), updated: Date.now() },
}

const queueTodos = [
  { content: "核查运营期监测数据", status: "completed", priority: "high" },
  { content: "列出预警测点和处置建议", status: "in_progress", priority: "high" },
]

const queuePermission = {
  id: "perm-e2e",
  sessionID: "queue-e2e",
  permission: "edit",
  patterns: ["成果报告.md"],
  metadata: {},
  always: [],
}

const queueMessages = [
  {
    info: {
      id: "msg_1",
      sessionID: "queue-e2e",
      role: "user",
      time: { created: Date.now() - 2_000 },
      agent: "chief_manager",
      model: { providerID: "deepseek", modelID: "deepseek-v4" },
    },
    parts: [
      { id: "prt_1", sessionID: "queue-e2e", messageID: "msg_1", type: "text", text: "复核本周运营期监测预警" },
      {
        id: "prt_1_route",
        sessionID: "queue-e2e",
        messageID: "msg_1",
        type: "text",
        synthetic: true,
        text: `<railwise_routing>
推荐工具：
- survey_calculator_leveling_closure: 水准闭合差检核 - 计算水准闭合差并判断限差。
- resurvey_material_check: 复测资料检查 - 检查复测资料完整性。
</railwise_routing>`,
      },
    ],
  },
  {
    info: {
      id: "msg_2",
      sessionID: "queue-e2e",
      role: "assistant",
      time: { created: Date.now() - 1_000, completed: Date.now() - 500 },
      parentID: "msg_1",
      modelID: "deepseek-v4",
      providerID: "deepseek",
      mode: "primary",
      agent: "chief_manager",
      path: { cwd: "/tmp/railwise-e2e/worktree", root: "/tmp/railwise-e2e/worktree" },
      cost: 0.001,
      tokens: { input: 1200, output: 240, reasoning: 0, cache: { read: 0, write: 0 } },
    },
    parts: [
      {
        id: "prt_2",
        sessionID: "queue-e2e",
        messageID: "msg_2",
        type: "tool",
        callID: "call-e2e",
        tool: "survey_calculator_leveling_closure",
        state: {
          status: "completed",
          input: { file: "运营期监测数据.xlsx" },
          output: "闭合差满足限差。",
          title: "水准闭合差检核",
          metadata: { pass: true, outputPath: "/tmp/railwise-e2e/worktree/闭合差复核.md" },
          time: { start: Date.now() - 900, end: Date.now() - 700 },
          attachments: [
            {
              id: "prt_2_attachment",
              sessionID: "queue-e2e",
              messageID: "msg_2",
              type: "file",
              url: "file:///tmp/railwise-e2e/worktree/成果报告.md",
              mime: "text/markdown",
              filename: "成果报告.md",
              source: { type: "file", path: "/tmp/railwise-e2e/worktree/成果报告.md", text: { value: "", start: 0, end: 0 } },
            },
          ],
        },
      },
    ],
  },
]

const failedQueueMessage = {
  info: {
    id: "msg_3",
    sessionID: "queue-e2e",
    role: "assistant",
    time: { created: Date.now() - 400, completed: Date.now() - 200 },
    parentID: "msg_1",
    modelID: "deepseek-v4",
    providerID: "deepseek",
    mode: "primary",
    agent: "chief_manager",
    path: { cwd: "/tmp/railwise-e2e/worktree", root: "/tmp/railwise-e2e/worktree" },
    cost: 0.001,
    tokens: { input: 900, output: 180, reasoning: 0, cache: { read: 0, write: 0 } },
  },
  parts: [
    {
      id: "prt_3",
      sessionID: "queue-e2e",
      messageID: "msg_3",
      type: "tool",
      callID: "call-e2e-failed",
      tool: "resurvey_material_check",
      state: {
        status: "error",
        input: { path: "控制点成果/CP001.xlsx" },
        error: "ENOENT: no such file or directory, open '控制点成果/CP001.xlsx'",
        title: "复测资料检查",
        time: { start: Date.now() - 350, end: Date.now() - 250 },
      },
    },
  ],
}

const sessionMessages = (opts: LaunchOptions) => (opts.toolFailure ? [...queueMessages, failedQueueMessage] : queueMessages)

const mcp = {
  railwise_inspector: { status: "connected" },
  report_exporter: { status: "disabled" },
}

const commands = [
  {
    name: "quality-report",
    description: "生成外业质量报告",
    template: "请生成 {{项目名称}} 的质量报告。",
    source: ".railwise/command",
    agent: "qa_inspector",
  },
]

const capabilities = [
  {
    id: "railwise.harness.safe",
    kind: "harness_profile",
    name: "本地安全模式",
    description: "默认要求用户确认写文件、执行命令和访问外部目录。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["安全", "默认"],
  },
  {
    id: "railwise.agent.chief_manager",
    kind: "agent",
    name: "RAILWISE 默认协作",
    description: "接收任务、拆解计划，并协调专业智能体执行。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["协作", "调度"],
  },
  ...toolCatalog.map((item) => ({
    id: `railwise.tool.${item.id}`,
    kind: "tool",
    name: item.name,
    description: item.description,
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: item.permissions,
    tags: item.tags,
  })),
  ...skillCatalog.map((item) => ({
    id: `railwise.skill.${item.id}`,
    kind: "skill",
    name: item.name,
    description: item.description,
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: item.permissions,
    tags: item.tags,
  })),
  {
    id: "railwise.workflow.metro_monitoring_report",
    kind: "workflow",
    name: "地铁监测月报",
    description: "串联数据首检、异常分析、报告编制和技术审校。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "write", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["监测", "报告"],
  },
  {
    id: "railwise.mcp.knowledge_base",
    kind: "mcp",
    name: "知识库连接器",
    description: "连接本地或企业知识库，供规范检索和资料审查使用。",
    version: "0.1.0",
    source: "builtin",
    enabled: false,
    installed: true,
    permissions: { filesystem: "read", network: true, shell: false, external_directory: true, secrets: true },
    tags: ["知识库", "MCP"],
  },
  {
    id: "railwise.provider.deepseek",
    kind: "provider",
    name: "DeepSeek",
    description: "推荐默认模型 Provider，可为不同智能体配置不同模型。",
    version: "0.1.0",
    source: "builtin",
    enabled: false,
    installed: true,
    permissions: { filesystem: "none", network: true, shell: false, external_directory: false, secrets: true },
    tags: ["模型", "推荐"],
  },
]

const provider = {
  all: [
    {
      id: "deepseek",
      name: "DeepSeek",
      source: "api",
      env: ["DEEPSEEK_API_KEY"],
      options: {},
      models: {
        "deepseek-v4": {
          id: "deepseek-v4",
          name: "DeepSeek V4",
          family: "deepseek",
          release_date: "2026-05-01",
          attachment: false,
          reasoning: true,
          temperature: true,
          tool_call: true,
          cost: { input: 0.0000005, output: 0.0000015 },
          limit: { context: 128000, output: 8192 },
          options: {},
        },
      },
    },
  ],
  default: { deepseek: "deepseek-v4" },
  connected: ["deepseek"],
}

export const test = base.extend<Fixtures>({
  launchApp: async ({ page, context }, use) => {
    await use(async (path = "/home", opts = {}) => {
      await setup(page, opts)
      await page.goto(path)
      await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 30_000 })
      return { page, context }
    })
  },
})

export { expect }

async function setup(page: Page, opts: LaunchOptions) {
  let market = capabilities.map((item) => ({ ...item }))
  let connected = opts.model === "configured" ? ["deepseek"] : []
  const isServerRoute = (url: URL, path: string) => url.origin === server && url.pathname === path

  if (process.env.RW_E2E_DEBUG === "1") {
    page.on("console", (msg) => console.log(`[browser:${msg.type()}] ${msg.text()}`))
    page.on("pageerror", (err) => console.log(`[browser:pageerror] ${err.stack ?? err.message}`))
    page.on("request", (req) => {
      if (req.url().includes("/src/entry") || req.url().includes("/src/index")) console.log(`[browser:request] ${req.url()}`)
    })
    page.on("response", (res) => {
      if (res.url().includes("/src/entry") || res.url().includes("/src/index")) {
        console.log(`[browser:response] ${res.status()} ${res.headers()["content-type"] ?? ""} ${res.url()}`)
      }
    })
    page.on("requestfailed", (req) => console.log(`[browser:requestfailed] ${req.url()} ${req.failure()?.errorText}`))
  }

  await page.route(`${server}/global/health`, (route) => json(route, { healthy: true, version: "e2e" }))
  await page.route(`${server}/global/event`, (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: "event: message\ndata: {\"type\":\"server.connected\",\"properties\":{}}\n\n",
    }),
  )
  await page.route(`${server}/path`, (route) =>
    json(route, {
      home: "/tmp",
      state: "/tmp/railwise-e2e/state",
      config: "/tmp/railwise-e2e/config",
      worktree: "/tmp/railwise-e2e/worktree",
      directory: "/tmp/railwise-e2e/worktree",
    }),
  )
  await page.route(`${server}/global/config`, (route) => json(route, {}))
  await page.route(`${server}/global/dispose`, (route) => json(route, true))
  await page.route(`${server}/config`, (route) => json(route, {}))
  await page.route(`${server}/project`, (route) => json(route, opts.projects ?? []))
  await page.route(`${server}/project/current`, (route) =>
    json(
      route,
      opts.projects?.[0] ?? {
        id: "railwise-e2e",
        worktree: "/tmp/railwise-e2e/worktree",
        time: { created: Date.now(), updated: Date.now() },
      },
    ),
  )
  await page.route(`${server}/provider`, (route) => json(route, { ...provider, connected }))
  await page.route(`${server}/auth/**`, (route) => {
    if (route.request().method() !== "PUT") return json(route, true)
    const id = new URL(route.request().url()).pathname.split("/").pop()
    if (id && !connected.includes(id)) connected = [...connected, id]
    return json(route, true)
  })
  await page.route((url) => isServerRoute(url, "/file/content"), (route) => {
    const url = new URL(route.request().url())
    const target = url.searchParams.get("path") ?? ""
    const file = (opts.workspaceFiles ?? []).find((item) => {
      const name = item.path.split(/[\\/]/).pop() ?? item.path
      return item.path === target || name === target || item.path.endsWith(`/${target}`)
    })
    const content = file?.content ?? (file?.kind === "md" ? `# ${file.path.split(/[\\/]/).pop()}` : csv)
    return json(route, { type: "text", content, mimeType: file?.kind === "md" ? "text/markdown" : "text/plain" })
  })
  await page.route((url) => isServerRoute(url, "/file"), (route) => {
    const url = new URL(route.request().url())
    const root = (opts.workspaceFiles ?? []).map((file) => ({
      name: file.path.split(/[\\/]/).pop() ?? file.path,
      path: file.path.split(/[\\/]/).pop() ?? file.path,
      absolute: file.path,
      type: "file",
      ignored: false,
    }))
    return json(route, url.searchParams.get("path") ? [] : root)
  })
  await page.route(`${server}/provider/auth`, (route) => json(route, {}))
  await page.route(`${server}/agent`, (route) => json(route, agents))
  await page.route(`${server}/session?**`, (route) => json(route, opts.emptySessions ? [] : [queueSession]))
  await page.route(`${server}/session/status`, (route) => json(route, { "queue-e2e": { type: "busy" } }))
  const permissions = opts.permission === "none" ? [] : [queuePermission]
  await page.route(`${server}/permission`, (route) => json(route, permissions))
  await page.route(`${server}/session/queue-e2e/permissions/perm-e2e`, (route) => json(route, true))
  await page.route(`${server}/question`, (route) => json(route, []))
  await page.route(`${server}/session/queue-e2e`, (route) => json(route, queueSession))
  await page.route(`${server}/session/queue-e2e/message**`, (route) => json(route, sessionMessages(opts)))
  await page.route(`${server}/session/queue-e2e/todo`, (route) => json(route, queueTodos))
  await page.route(`${server}/marketplace/capabilities`, (route) => json(route, { data: market }))
  await page.route(`${server}/marketplace/capabilities/**`, (route) => {
    const url = new URL(route.request().url())
    const parts = url.pathname.split("/")
    const id = decodeURIComponent(parts.at(-2) ?? "")
    const action = parts.at(-1)
    const item = market.find((capability) => capability.id === id)
    if (!item) return json(route, { name: "CapabilityNotFound", message: "Capability not found", data: { id } }, 404)
    const next = { ...item, enabled: action === "enable", installed: true }
    market = market.map((capability) => (capability.id === id ? next : capability))
    return json(route, next)
  })
  await page.route(`${server}/agent-studio/workflow/run`, (route) => json(route, { sessionId: "workflow-e2e" }))
  await page.route(`${server}/agent-studio/workflow/presets`, (route) => json(route, [workflow]))
  await page.route(`${server}/agent-studio/list`, (route) => json(route, agents))
  await page.route(`${server}/agent-studio/tool/list`, (route) => json(route, tools))
  await page.route(`${server}/agent-studio/skill/list`, (route) => json(route, skills))
  await page.route(`${server}/agent-studio/chief_manager`, (route) => {
    if (route.request().method() === "PUT") return json(route, true)
    return json(route, { ...agents[0], rawMarkdown: "---\nname: chief_manager\n---\n你负责理解任务、拆解步骤，并按需要调度专业智能体与工具。" })
  })
  await page.route(`${server}/mcp`, (route) => json(route, mcp))
  await page.route(`${server}/command`, (route) => json(route, commands))
  await page.route(`${server}/templates/list`, (route) => json(route, templates))
  await page.route(`${server}/session/*/prompt_async`, (route) => json(route, { ok: true }))
  await page.route(`${server}/session`, (route) => json(route, { id: "queue-e2e" }))

  await page.addInitScript(
    (input) => {
      type HarnessWindow = Window &
        typeof globalThis & {
          __RAILWISE__?: { browserHarness?: boolean; updaterEnabled?: boolean }
          __TAURI_INTERNALS__?: {
            callbacks: Map<number, (data: unknown) => unknown>
            convertFileSrc: (path: string) => string
            invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>
            runCallback: (id: number, data: unknown) => void
            transformCallback: (callback?: (data: unknown) => unknown, once?: boolean) => number
            unregisterCallback: (id: number) => void
          }
          __TAURI_EVENT_PLUGIN_INTERNALS__?: { unregisterListener: () => void }
          __TAURI_OS_PLUGIN_INTERNALS__?: Record<string, string>
        }
      const win = window as HarnessWindow
      const callbacks = new Map<number, (data: unknown) => unknown>()
      let next = 1
      let resource = 1000
      const stores = new Map<number, Map<string, unknown>>()
      const storePaths = new Map<string, number>()
      const seedStore = (path: string, data: Map<string, unknown>) => {
        const rid = resource++
        storePaths.set(path, rid)
        stores.set(rid, data)
        return rid
      }
      const loadStore = (path: string) => {
        const cached = storePaths.get(path)
        if (cached) return cached
        return seedStore(path, new Map())
      }
      const readStore = (rid: unknown) => stores.get(Number(rid))
      seedStore("railwise.global.dat", new Map([["language", JSON.stringify({ locale: "zh" })]]))
      if (input.debug) {
        window.addEventListener("error", (event) => {
          console.log("[browser:window-error]", event.message, event.filename, event.lineno)
        })
        window.addEventListener("unhandledrejection", (event) => {
          const reason = event.reason
          console.log("[browser:unhandled]", reason?.stack ?? reason?.message ?? String(reason))
        })
      }
      win.__RAILWISE__ = { ...(win.__RAILWISE__ ?? {}), browserHarness: true, updaterEnabled: true }
      win.__TAURI_OS_PLUGIN_INTERNALS__ = {
        arch: "x86_64",
        eol: "\n",
        exe_extension: "",
        family: "unix",
        os_type: "macos",
        platform: "macos",
        version: "e2e",
      }
      win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined }
      win.__TAURI_INTERNALS__ = {
        callbacks,
        convertFileSrc: (path) => `asset://localhost/${encodeURIComponent(path)}`,
        invoke: async (command, args = {}) => {
          if (command === "await_initialization") {
            const event = args.events
            const id =
              typeof event === "string" && event.startsWith("__CHANNEL__:")
                ? Number(event.slice("__CHANNEL__:".length))
                : typeof event === "object" && event && "id" in event
                  ? Number(event.id)
                  : undefined
            if (id) win.__TAURI_INTERNALS__?.runCallback(id, { id: 0, message: { phase: "done" }, end: true })
            return { url: input.server, password: null }
          }
          if (command === "read_text_file") return input.csv
          if (command === "convert_sheet_to_csv") return input.csv
          if (command === "parse_dxf") return input.dxf
          if (command === "convert_dwg_to_dxf") return "/tmp/sample-survey.dxf"
          if (command === "convert_pptx_to_images") return []
          if (command === "convert_docx_to_html") return "<article>DOCX E2E</article>"
          if (command === "parse_markdown_command") return "<article>Markdown E2E</article>"
          if (command === "get_default_server_url") return null
          if (command === "get_wsl_config") return { enabled: false }
          if (command === "set_wsl_config") return null
          if (command === "get_display_backend") return null
          if (command === "set_display_backend") return null
          if (command === "kill_sidecar") return null
          if (command === "check_app_exists") return true
          if (command === "resolve_app_path") return null
          if (command === "wsl_path") return args.path
          if (command === "plugin:store|load") return loadStore(typeof args.path === "string" ? args.path : "default.dat")
          if (command === "plugin:store|get_store") return storePaths.get(typeof args.path === "string" ? args.path : "") ?? null
          if (command === "plugin:store|get") {
            const store = readStore(args.rid)
            const key = typeof args.key === "string" ? args.key : ""
            if (!store || !store.has(key)) return [null, false]
            return [store.get(key), true]
          }
          if (command === "plugin:store|set") {
            const store = readStore(args.rid)
            if (store && typeof args.key === "string") store.set(args.key, args.value)
            return null
          }
          if (command === "plugin:store|delete") {
            const store = readStore(args.rid)
            if (!store || typeof args.key !== "string") return false
            return store.delete(args.key)
          }
          if (command === "plugin:store|has") {
            const store = readStore(args.rid)
            return typeof args.key === "string" ? (store?.has(args.key) ?? false) : false
          }
          if (command === "plugin:store|clear" || command === "plugin:store|reset") {
            readStore(args.rid)?.clear()
            return null
          }
          if (command === "plugin:store|keys") return Array.from(readStore(args.rid)?.keys() ?? [])
          if (command === "plugin:store|values") return Array.from(readStore(args.rid)?.values() ?? [])
          if (command === "plugin:store|entries") return Array.from(readStore(args.rid)?.entries() ?? [])
          if (command === "plugin:store|length") return readStore(args.rid)?.size ?? 0
          if (command === "plugin:store|reload" || command === "plugin:store|save") return null
          if (command === "plugin:menu|new") {
            const kind = typeof args.kind === "string" ? args.kind : "MenuItem"
            return [resource++, `${kind.toLowerCase()}-e2e-${resource}`]
          }
          if (command === "plugin:menu|create_default") return [resource++, `menu-e2e-${resource}`]
          if (command === "plugin:menu|items") return []
          if (command === "plugin:menu|get") return null
          if (command === "plugin:menu|text") return ""
          if (command === "plugin:menu|is_enabled") return true
          if (command === "plugin:menu|remove_at") return null
          if (command === "plugin:menu|set_as_app_menu") return null
          if (command === "plugin:menu|set_as_window_menu") return null
          if (command.startsWith("plugin:")) return null
          return null
        },
        runCallback: (id, data) => void callbacks.get(id)?.(data),
        transformCallback: (callback, once = false) => {
          const id = next++
          callbacks.set(id, (data) => {
            if (once) callbacks.delete(id)
            return callback?.(data)
          })
          return id
        },
        unregisterCallback: (id) => callbacks.delete(id),
      }
      if (input.workspace.length > 0) {
        localStorage.setItem(
          "rw_workspace_recent",
          JSON.stringify(
            input.workspace.map((file) => ({
              id: file.path,
              name: file.path.split(/[\\/]/).pop() ?? file.path,
              path: file.path,
              kind: file.kind,
            })),
          ),
        )
      }
    },
    { csv, dxf, server, workspace: opts.workspaceFiles ?? [], debug: process.env.RW_E2E_DEBUG === "1" },
  )
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}
