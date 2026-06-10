import { expect, test as base, type BrowserContext, type Page, type Route } from "@playwright/test"

type WorkspaceFile = {
  path: string
  kind: "csv" | "dxf" | "pptx"
}

type LaunchOptions = {
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

const cpiii = {
  id: "cpiii-resurvey-wiki",
  name: "CPIII 规范查询与复测预案",
  description: "规范查询、复测方案、格式样本覆盖与交付验收。",
  nodes: [
    { id: "a", agent: "chief_manager", label: "任务拆解", color: "#755620", x: 20, y: 40 },
    { id: "b", agent: "researcher", label: "规范查询", color: "#2b6f71", x: 230, y: 112 },
    { id: "c", agent: "qa_inspector", label: "复测校核", color: "#8a6a34", x: 456, y: 40 },
    { id: "d", agent: "writer", label: "交付摘要", color: "#5f4618", x: 680, y: 112 },
  ],
  edges: [
    { from: "a", to: "b", kind: "serial", label: "查询" },
    { from: "b", to: "c", kind: "serial", label: "校核" },
    { from: "c", to: "d", kind: "serial", label: "交付" },
  ],
}

const session = {
  id: "workflow-e2e",
  slug: "workflow-e2e",
  projectID: "railwise-e2e",
  directory: "/tmp/railwise-e2e",
  title: "工作流：CPIII 规范查询与复测预案",
  version: "v2",
  time: { created: 1_777_200_000_000, updated: 1_777_200_060_000 },
}

const artifact = {
  kind: "format-coverage",
  title: "格式样本覆盖",
  markdownPath: ".railwise/workflows/cpiii-format-coverage.md",
  absoluteMarkdownPath: "/tmp/railwise-e2e/.railwise/workflows/cpiii-format-coverage.md",
  jsonPath: ".railwise/workflows/cpiii-format-coverage.json",
  absoluteJsonPath: "/tmp/railwise-e2e/.railwise/workflows/cpiii-format-coverage.json",
}

const acceptance = {
  workflowId: cpiii.id,
  sessionId: session.id,
  ok: true,
  generatedAt: "2026-04-26T08:32:00.000Z",
  messageCount: 2,
  checks: [
    { id: "message", label: "交付输出", status: "ok", detail: "已输出复测方案、规范引用与工具结果摘要。" },
    { id: "artifact", label: "附件引用", status: "ok", detail: "已登记格式样本覆盖 Markdown 与 JSON 附件。" },
    { id: "format", label: "格式覆盖", status: "ok", detail: "CPIII 样本格式可读并覆盖核心字段。" },
  ],
}

const delivery = {
  sessionId: session.id,
  workflowId: cpiii.id,
  workflowName: cpiii.name,
  version: 1,
  generatedAt: "2026-04-26T08:34:00.000Z",
  directoryPath: ".railwise/delivery/workflow-e2e",
  absoluteDirectoryPath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e",
  markdownPath: ".railwise/delivery/workflow-e2e/summary.md",
  absoluteMarkdownPath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e/summary.md",
  manifestPath: ".railwise/delivery/workflow-e2e/manifest.json",
  absoluteManifestPath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e/manifest.json",
  fileCount: 3,
  files: [
    {
      kind: "summary",
      label: "交付摘要 Markdown",
      path: ".railwise/delivery/workflow-e2e/summary.md",
      absolutePath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e/summary.md",
      copied: true,
    },
    {
      kind: "artifact",
      label: "格式样本覆盖",
      path: ".railwise/delivery/workflow-e2e/artifacts/cpiii-format-coverage.md",
      absolutePath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e/artifacts/cpiii-format-coverage.md",
      sourcePath: artifact.absoluteMarkdownPath,
      copied: true,
    },
    {
      kind: "manifest",
      label: "交付清单 JSON",
      path: ".railwise/delivery/workflow-e2e/manifest.json",
      absolutePath: "/tmp/railwise-e2e/.railwise/delivery/workflow-e2e/manifest.json",
      copied: true,
    },
  ],
}

const messages = [
  {
    info: {
      id: "msg-user",
      sessionID: session.id,
      role: "user",
      time: { created: 1_777_200_010_000 },
      agent: "chief_manager",
      model: { providerID: "railwise", modelID: "e2e" },
    },
    parts: [
      {
        id: "part-user",
        sessionID: session.id,
        messageID: "msg-user",
        type: "text",
        text: "请执行 CPIII 规范查询与复测预案工作流。",
      },
    ],
  },
  {
    info: {
      id: "msg-assistant",
      sessionID: session.id,
      role: "assistant",
      time: { created: 1_777_200_020_000, completed: 1_777_200_040_000 },
      parentID: "msg-user",
      modelID: "e2e",
      providerID: "railwise",
      mode: "build",
      agent: "chief_manager",
      path: { cwd: ".", root: "." },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      finish: "end_turn",
    },
    parts: [
      {
        id: "part-assistant",
        sessionID: session.id,
        messageID: "msg-assistant",
        type: "text",
        text: "已完成 CPIII 规范引用、格式样本覆盖与复测交付摘要。",
      },
    ],
  },
]

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

const tools = [
  { id: "agent.task", label: "智能体调度", group: "agent" },
  { id: "norm.search", label: "规范检索", group: "knowledge" },
  { id: "survey.adjustment", label: "平差计算", group: "survey" },
  { id: "file.read", label: "文件读取", group: "core" },
  { id: "report.export", label: "报告导出", group: "extension" },
] as const

const skills = [
  {
    name: "CPIII 复测",
    description: "按高铁 CPIII 场景组织复测资料检查、规范引用和交付摘要。",
    location: ".railwise/skills/cpiii-resurvey.md",
  },
  {
    name: "沉降监测日报",
    description: "汇总外业观测数据、异常点和日报结论。",
    location: ".railwise/skills/settlement-daily.md",
  },
]

const permissions = {
  filesystem: "read",
  network: false,
  shell: false,
  external_directory: false,
  secrets: false,
} as const

const capabilities = [
  {
    id: "railwise.agent.chief_manager",
    kind: "agent",
    name: "RAILWISE 默认协作",
    description: "理解任务、拆解计划，并协调专业智能体、工具和 Skill 完成交付。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions,
    tags: ["协作", "任务拆解"],
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
    permissions,
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
    permissions,
    tags: ["测绘", "资料检查"],
  },
  {
    id: "railwise.provider.deepseek",
    kind: "provider",
    name: "DeepSeek",
    description: "默认推荐的中文工程任务模型提供方。",
    version: "0.1.0",
    source: "builtin",
    enabled: false,
    installed: true,
    permissions: { filesystem: "none", network: true, shell: false, external_directory: false, secrets: true },
    tags: ["模型", "推荐"],
  },
  {
    id: "railwise.harness.safe",
    kind: "harness_profile",
    name: "本地安全模式",
    description: "默认要求用户确认写文件、执行命令和访问外部目录。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions,
    tags: ["安全", "默认"],
  },
] as const

export const test = base.extend<Fixtures>({
  launchApp: async ({ page, context }, use) => {
    await use(async (path = "/home", opts = {}) => {
      await setup(page, opts)
      await page.goto(path)
      await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 75_000 })
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
      if (req.url().includes("/src/entry") || req.url().includes("/src/index"))
        console.log(`[browser:request] ${req.url()}`)
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
      body: 'event: message\ndata: {"directory":"global","payload":{"type":"server.connected","properties":{}}}\n\n',
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
  await page.route(`${server}/project`, (route) => json(route, []))
  await page.route(`${server}/provider`, (route) => json(route, { all: [], default: {}, connected: [] }))
  await page.route(`${server}/provider/auth`, (route) => json(route, {}))
  await page.route(`${server}/marketplace/capabilities`, (route) => json(route, { data: capabilities }))
  await page.route(`${server}/marketplace/capabilities/*`, (route) => json(route, capabilities[0]))
  await page.route(`${server}/harness/status*`, (route) =>
    json(route, {
      workspace: "/tmp/railwise-e2e/worktree",
      mode: "safe",
      capabilityCount: capabilities.length,
      pendingPermissionCount: 0,
      runningToolCount: 0,
      updatedAt: "2026-06-03T00:00:00.000Z",
    }),
  )
  await page.route(`${server}/harness/session/*/timeline`, (route) => json(route, []))
  await page.route(`${server}/harness/session/*/permissions`, (route) => json(route, []))
  await page.route(`${server}/agent-studio/workflow/run`, (route) => {
    const input = route.request().postDataJSON() as { workflowId?: string }
    const item = input.workflowId === cpiii.id ? cpiii : workflow
    return json(route, {
      sessionId: session.id,
      sessionTitle: `工作流：${item.name}`,
      workflowId: item.id,
      directory: session.directory,
      prompt: `请执行 ${item.name} 工作流。`,
      artifacts: item.id === cpiii.id ? [artifact] : [],
    })
  })
  await page.route(`${server}/agent-studio/workflow/presets`, (route) => json(route, [workflow, cpiii]))
  await page.route(`${server}/agent-studio/workflow/check/*`, (route) =>
    json(route, {
      workflowId: cpiii.id,
      ok: true,
      generatedAt: "2026-04-26T08:30:00.000Z",
      checks: [
        { id: "wiki", label: "知识库", status: "ok", detail: "CPIII 规范索引可用。" },
        { id: "format", label: "格式样本", status: "ok", detail: "格式样本覆盖报告已生成。" },
      ],
    }),
  )
  await page.route(`${server}/agent-studio/workflow/session/workflow-e2e`, (route) =>
    json(route, {
      sessionId: session.id,
      workflowId: cpiii.id,
      workflowName: cpiii.name,
      createdAt: "2026-04-26T08:30:00.000Z",
      updatedAt: "2026-04-26T08:31:00.000Z",
      artifacts: [artifact],
    }),
  )
  await page.route(`${server}/agent-studio/workflow/acceptance`, (route) => json(route, acceptance))
  await page.route(`${server}/agent-studio/workflow/delivery/archive`, (route) => json(route, delivery))
  await page.route(`${server}/agent-studio/format/report`, (route) =>
    json(route, {
      generatedAt: "2026-04-26T08:29:00.000Z",
      sampleCount: 1,
      readyCount: 1,
      formatCount: 1,
      coveredFormatCount: 1,
      warningCount: 0,
      samples: [
        {
          id: "cpiii-adjustment",
          label: "CPIII 平差样本",
          sourceFormat: "txt",
          expectedFormat: "cpiii-adjustment",
          detectedFormat: "cpiii-adjustment",
          ready: true,
          warningCount: 0,
          warningLines: [],
          warnings: [],
          pointCount: 12,
          observationCount: 24,
          equationCount: 8,
          unknowns: ["X", "Y", "H"],
          equationNames: ["distance", "level"],
        },
      ],
      artifacts: {
        markdownPath: artifact.markdownPath,
        absoluteMarkdownPath: artifact.absoluteMarkdownPath,
        jsonPath: artifact.jsonPath,
        absoluteJsonPath: artifact.absoluteJsonPath,
      },
    }),
  )
  await page.route(`${server}/agent-studio/wiki/status`, (route) =>
    json(route, {
      pageCount: 8,
      rawCount: 5,
      reportCount: 1,
      readonly: false,
      reports: [
        {
          kind: "format",
          path: artifact.markdownPath,
          absolutePath: artifact.absoluteMarkdownPath,
          generatedAt: "2026-04-26T08:29:00.000Z",
          sampleCount: 1,
          readyCount: 1,
          warningCount: 0,
          problemCount: 0,
        },
      ],
      logs: [],
    }),
  )
  await page.route(`${server}/agent-studio/wiki/report?*`, (route) =>
    json(route, {
      kind: "format",
      path: artifact.markdownPath,
      absolutePath: artifact.absoluteMarkdownPath,
      generatedAt: "2026-04-26T08:29:00.000Z",
      content: "# 格式样本覆盖\n\nCPIII 平差样本通过。",
    }),
  )
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
  await page.route(`${server}/session/workflow-e2e/message*`, (route) => json(route, messages))
  await page.route(`${server}/session/workflow-e2e/todo*`, (route) => json(route, []))
  await page.route(`${server}/session/workflow-e2e/diff*`, (route) => json(route, []))
  await page.route(`${server}/session/workflow-e2e*`, (route) => json(route, session))
  await page.route(`${server}/session/*/prompt_async`, (route) => json(route, { ok: true }))
  await page.route(`${server}/session`, (route) => json(route, { id: "queue-e2e" }))

  await page.addInitScript(
    (input) => {
      type HarnessWindow = Window &
        typeof globalThis & {
          __RAILWISE__?: { browserHarness?: boolean; updatesEnabled?: boolean }
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
      if (input.debug) {
        window.addEventListener("error", (event) => {
          console.log("[browser:window-error]", event.message, event.filename, event.lineno)
        })
        window.addEventListener("unhandledrejection", (event) => {
          const reason = event.reason
          console.log("[browser:unhandled]", reason?.stack ?? reason?.message ?? String(reason))
        })
      }
      win.__RAILWISE__ = { ...(win.__RAILWISE__ ?? {}), browserHarness: true, updatesEnabled: true }
      win.__TAURI_OS_PLUGIN_INTERNALS__ = {
        arch: "x86_64",
        eol: "\n",
        exe_extension: "",
        family: "unix",
        os_type: "macos",
        platform: "darwin",
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
