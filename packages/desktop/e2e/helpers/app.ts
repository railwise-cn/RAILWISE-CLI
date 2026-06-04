import { expect, test as base, type BrowserContext, type Page, type Route } from "@playwright/test"

type WorkspaceFile = {
  path: string
  kind: "csv" | "dxf" | "pptx"
}

type Project = {
  id?: string
  worktree: string
  time: {
    created: number
    updated?: number
  }
}

type LaunchOptions = {
  model?: "configured"
  projects?: Project[]
  workspaceFiles?: WorkspaceFile[]
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
    prompt: "你是 Railwise 总负责人。",
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

const tools = [
  { id: "task", label: "智能体任务调度", group: "agent" },
  { id: "skill", label: "专业流程加载", group: "agent" },
  { id: "standard_query_query_standard", label: "规范条文查询", group: "knowledge" },
  { id: "survey_calculator_leveling_closure", label: "水准闭合差检核", group: "survey" },
]

const skills = [
  {
    name: "monitoring-design",
    description: "工程监测方案设计",
    location: "/tmp/railwise-e2e/.railwise/skill/monitoring-design/SKILL.md",
  },
  {
    name: "data-analysis",
    description: "测绘数据平差与变形分析",
    location: "/tmp/railwise-e2e/.railwise/skill/data-analysis/SKILL.md",
  },
  {
    name: "standard-reference",
    description: "规范条文速查",
    location: "/tmp/railwise-e2e/.railwise/skill/standard-reference/SKILL.md",
  },
]

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
    name: "RAILWISE 主控",
    description: "理解任务、拆解计划，并调度专业智能体执行。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["主控", "调度"],
  },
  {
    id: "railwise.tool.file_reader",
    kind: "tool",
    name: "本地文件读取",
    description: "读取当前工作区内的工程文件。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["文件", "本地"],
  },
  {
    id: "railwise.skill.survey_review",
    kind: "skill",
    name: "复测资料检查",
    description: "检查线路复测资料完整性、缺失文件和交付风险。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: { filesystem: "read", network: false, shell: false, external_directory: false, secrets: false },
    tags: ["测绘", "资料检查"],
  },
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
  await page.route(`${server}/provider`, (route) =>
    json(route, opts.model === "configured" ? provider : { all: [], default: {}, connected: [] }),
  )
  await page.route(`${server}/provider/auth`, (route) => json(route, {}))
  await page.route(`${server}/agent`, (route) => json(route, agents))
  await page.route(`${server}/marketplace/capabilities`, (route) => json(route, { data: capabilities }))
  await page.route(`${server}/agent-studio/workflow/run`, (route) => json(route, { sessionId: "workflow-e2e" }))
  await page.route(`${server}/agent-studio/workflow/presets`, (route) => json(route, [workflow]))
  await page.route(`${server}/agent-studio/list`, (route) => json(route, agents))
  await page.route(`${server}/agent-studio/tool/list`, (route) => json(route, tools))
  await page.route(`${server}/agent-studio/skill/list`, (route) => json(route, skills))
  await page.route(`${server}/agent-studio/chief_manager`, (route) => {
    if (route.request().method() === "PUT") return json(route, true)
    return json(route, { ...agents[0], rawMarkdown: "---\nname: chief_manager\n---\n你是 Railwise 总负责人。" })
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

function json(route: Route, body: unknown) {
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}
