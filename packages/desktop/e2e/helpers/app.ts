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

const summary = {
  projects: [
    {
      id: "p1",
      name: "京沪高铁沉降监测",
      type: "bridge",
      status: "active",
      progress: 76,
      lastActivity: "2026-04-26T08:00:00.000Z",
      activeTaskCount: 3,
      description: "连续梁沉降与水平位移监测。",
      pointCount: 128,
      alertCount: 2,
    },
  ],
  alerts: [{ id: "a1", projectId: "p1", level: "warn", message: "JC-002 沉降接近预警阈值", time: "2026-04-26T08:10:00.000Z" }],
  recentSessions: [{ id: "s1", directory: "/tmp/railwise-e2e", title: "外业数据首检", time: { updated: Date.now() } }],
  activeAgents: [{ sessionId: "s1", agentName: "qa_inspector", startedAt: "2026-04-26T08:00:00.000Z", status: "running" }],
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

export const test = base.extend<Fixtures>({
  launchApp: async ({ page, context }, use) => {
    await use(async (path = "/dashboard", opts = {}) => {
      await setup(page, opts)
      await page.goto(path)
      await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 10_000 })
      return { page, context }
    })
  },
})

export { expect }

async function setup(page: Page, opts: LaunchOptions) {
  await page.route("**/event", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: "event: message\ndata: {\"type\":\"server.connected\",\"properties\":{}}\n\n",
    }),
  )
  await page.route("**/dashboard/summary", (route) => json(route, summary))
  await page.route("**/dashboard/projects/*/points", (route) =>
    json(route, {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          geometry: { type: "Point", coordinates: [116.4, 39.9] },
          properties: { name: "JC-001", status: "green", latestValue: -1.2, unit: "mm", owner: "E2E" },
        },
      ],
    }),
  )
  await page.route("**/agent-studio/workflow/run", (route) => json(route, { sessionId: "workflow-e2e" }))
  await page.route("**/agent-studio/workflow/presets", (route) => json(route, [workflow]))
  await page.route("**/agent-studio/list", (route) => json(route, agents))
  await page.route("**/agent-studio/chief_manager", (route) => {
    if (route.request().method() === "PUT") return json(route, true)
    return json(route, { ...agents[0], rawMarkdown: "---\nname: chief_manager\n---\n你是 Railwise 总负责人。" })
  })
  await page.route("**/mcp", (route) => json(route, mcp))
  await page.route("**/command", (route) => json(route, commands))
  await page.route("**/templates/list", (route) => json(route, templates))
  await page.route("**/session/*/prompt_async", (route) => json(route, { ok: true }))
  await page.route("**/session", (route) => json(route, { id: "queue-e2e" }))

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
      win.__RAILWISE__ = { ...(win.__RAILWISE__ ?? {}), browserHarness: true, updaterEnabled: true }
      win.__TAURI_OS_PLUGIN_INTERNALS__ = {
        arch: "x86_64",
        eol: "\n",
        exe_extension: "",
        family: "unix",
        os_type: "linux",
        platform: "linux",
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
      localStorage.setItem("rw_dashboard_cache", JSON.stringify(input.summary))
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
    { csv, dxf, server, summary, workspace: opts.workspaceFiles ?? [] },
  )
}

function json(route: Route, body: unknown) {
  return route.fulfill({
    contentType: "application/json",
    body: JSON.stringify(body),
  })
}
