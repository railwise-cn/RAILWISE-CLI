#!/usr/bin/env bun

import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const exists = async (...parts: string[]) => Bun.file(file(...parts)).exists()
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const specs = [
  "01-startup.spec.ts",
  "02-import-csv.spec.ts",
  "03-qa-inspector.spec.ts",
  "04-capability-marketplace.spec.ts",
  "05-workflow-pipeline.spec.ts",
  "06-dxf-viewer.spec.ts",
  "07-ppt-master.spec.ts",
  "08-offline-mode.spec.ts",
  "09-update-flow.spec.ts",
  "10-crash-recovery.spec.ts",
  "11-visual-regression.spec.ts",
  "12-ttfui.spec.ts",
]
const userDocs = [
  "01-installation.md",
  "02-quickstart.md",
  "03-agents.md",
  "04-templates.md",
  "05-workflow.md",
  "06-faq.md",
]
const adminDocs = ["01-deploy.md", "02-model-config.md", "03-proxy.md", "04-update-server.md", "05-security.md"]
const devDocs = [
  "CONTRIBUTING.md",
  "01-architecture.md",
  "02-templates-spec.md",
  "03-mcp-tools.md",
  "04-e2e-testing.md",
]
const missingSpecs = (
  await Promise.all(
    specs.map(async (spec) => {
      const target = path.join("packages/desktop/e2e", spec)
      return (await exists(target)) ? undefined : target
    }),
  )
).filter((item): item is string => Boolean(item))
const missingUserDocs = (
  await Promise.all(
    userDocs.map(async (doc) => {
      const target = path.join("docs/user", doc)
      return (await exists(target)) ? undefined : target
    }),
  )
).filter((item): item is string => Boolean(item))
const missingAdminDocs = (
  await Promise.all(
    adminDocs.map(async (doc) => {
      const target = path.join("docs/admin", doc)
      return (await exists(target)) ? undefined : target
    }),
  )
).filter((item): item is string => Boolean(item))
const missingDevDocs = (
  await Promise.all(
    devDocs.map(async (doc) => {
      const target = path.join("docs/dev", doc)
      return (await exists(target)) ? undefined : target
    }),
  )
).filter((item): item is string => Boolean(item))
const startup = await read("packages/desktop/e2e/01-startup.spec.ts")
const agentStudio = await read("packages/desktop/e2e/04-capability-marketplace.spec.ts")
const e2eHelper = await read("packages/desktop/e2e/helpers/app.ts")
const visual = await read("packages/desktop/e2e/11-visual-regression.spec.ts")
const ttfui = await read("packages/desktop/e2e/12-ttfui.spec.ts")
const app = await read("packages/app/src/app.tsx")
const home = await read("packages/app/src/pages/home.tsx")
const marketplace = await read("packages/app/src/pages/marketplace/index.tsx")
const agentsPage = await read("packages/app/src/pages/agents/index.tsx")
const agentCollaborationTest = await read("packages/app/src/pages/agents/collaboration.test.ts")
const sessionComposer = await read("packages/app/src/pages/session/composer/session-composer-region.tsx")
const sessionCollaboration = await read("packages/app/src/pages/session/composer/collaboration.ts")
const promptInput = await read("packages/app/src/components/prompt-input.tsx")
const config = await read("packages/desktop/playwright.config.ts")
const acceptance = await read("scripts/verify-desktop-acceptance.ts")
const consent = await read("packages/app/src/components/telemetry-consent.tsx")
const settings = await read("packages/app/src/context/settings.tsx")
const general = await read("packages/app/src/components/settings-general.tsx")
const telemetry = await read("packages/desktop/src/lib/telemetry/index.ts")
const store = await read("packages/desktop/src/lib/telemetry/store.ts")
const privacy = await read("packages/desktop/src/lib/telemetry/privacy.ts")
const docs = await read("docs/dev/06-m7-acceptance.md")
const desktopLanguageDocs = [
  await read("docs/dev/01-architecture.md"),
  await read("docs/dev/04-e2e-testing.md"),
  await read("docs/dev/05-release-cadence.md"),
  docs,
].join("\n")

check(
  "M7 E2E spec inventory",
  missingSpecs.length === 0,
  missingSpecs.length === 0 ? `${specs.length} required specs exist` : `missing: ${missingSpecs.join(", ")}`,
)
check(
  "startup E2E budget",
  has(startup, ["[data-testid=sidecar-status]", '"ready"', "15000", "[data-testid=home-workbench]"]),
  "startup waits for sidecar ready and lands on the home workbench within 15s",
)
check(
  "home collaboration handoff",
  has(home, [
    'data-testid="home-project-directory"',
    'data-testid="home-task-input"',
    'data-testid="home-start-session"',
    "collaborationTarget",
    "setSessionHandoff(target.key, { agent: target.agent, prompt: target.prompt })",
  ]) &&
    has(sessionComposer, [
      "handoffAgent",
      "handoffPromptParts",
      "modelAction",
      "modelStatus",
      "local.agent.set(agent)",
      'data-testid="session-collaboration-panel"',
      'data-testid="session-model-readiness"',
      'data-testid="session-model-setup"',
    ]) &&
    has(promptInput, ['data-testid="session-prompt-input"']) &&
    has(e2eHelper, ['model?: "configured"', "deepseek-v4", "DEEPSEEK_API_KEY"]) &&
    has(startup, [
      "[data-testid=home-project-directory]",
      "[data-testid=home-task-input]",
      "[data-testid=home-start-session]",
      "[data-testid=session-collaboration-panel]",
      "[data-testid=session-model-readiness]",
      "[data-testid=session-model-setup]",
      "[data-testid=session-prompt-input]",
      "chief_manager",
      'model: "configured"',
      "/session/queue-e2e/prompt_async",
      'payload.agent).toBe("chief_manager"',
      'providerID: "deepseek", modelID: "deepseek-v4"',
    ]),
  "home creates a chief_manager handoff and can send the first prompt when a model is configured",
)
check(
  "marketplace separated from advanced agent management",
  has(app, ["const AgentsIndexRoute", "<AgentsIndex />", "const MarketplaceRoute"]) &&
    has(marketplace, [
      'data-testid="marketplace-page"',
      "marketplace-console",
      "marketplace-row-${item.id}",
      "marketplace-open-${selected().id}",
      "marketplace-row-state-${item.id}",
      "marketplace-preview-${selected().id}",
    ]) &&
    !marketplace.includes("marketplace-grid") &&
    !marketplace.includes("marketplace-provider-strip") &&
    !marketplace.includes("marketplace-card") &&
    !marketplace.includes("agent-collaboration-start") &&
    !marketplace.includes("agent-model-routing") &&
    has(agentStudio, ['launchApp("/marketplace")', 'launchApp("/agents")', "toHaveCount(0)", "agent-collaboration-start"]),
  "marketplace stays as one concise registry plus detail panel while /agents keeps advanced management",
)
check(
  "desktop product language",
  !desktopLanguageDocs.includes("Agent Studio") &&
    !desktopLanguageDocs.includes("Harness Profile") &&
    !desktopLanguageDocs.includes("工具/Skills") &&
    !e2eHelper.includes("Skills 加载") &&
    !agentCollaborationTest.includes("Agent Studio") &&
    !sessionCollaboration.includes("Skill「") &&
    sessionCollaboration.includes("请使用专业流程") &&
    agentsPage.includes("RAILWISE 高级智能体管理") &&
    agentsPage.includes("上下文文件夹") &&
    agentsPage.includes("智能体库") &&
    agentsPage.includes("#agent-library") &&
    !agentsPage.includes("RAILWISE 能力市场") &&
    !agentsPage.includes("项目工作区") &&
    !agentsPage.includes("智能体矩阵") &&
    !(await exists("packages/desktop/e2e/04-agent-studio.spec.ts")),
  "Desktop docs, E2E fixtures, and advanced management page use capability market, professional workflow, and execution-layer language",
)

check(
  "marketplace inventory state",
  has(e2eHelper, ["/agent-studio/tool/list", "/agent-studio/skill/list", "规范条文查询", "monitoring-design"]) &&
    has(agentStudio, [
      "marketplace-row-state-agents",
      "marketplace-row-state-tools",
      "marketplace-row-state-skills",
      "marketplace-row-state-providers",
      "marketplace-preview-tools",
      "marketplace-preview-skills",
      "执行层",
      "流程",
    ]) &&
    !marketplace.includes("label: \"Agents\"") &&
    !marketplace.includes("label: \"Tools\"") &&
    !marketplace.includes("label: \"Skills\""),
  "marketplace asserts enabled inventory state for agents, tools, skills, and provider setup",
)
check(
  "minimal home workbench source",
  has(home, [
    'data-testid="home-workbench"',
    'data-testid="home-chat-composer"',
    'data-testid="home-project-directory"',
    'data-testid="home-task-input"',
    'data-testid="home-start-session"',
    "想让 RAILWISE 完成什么？",
    'navigate("/harness")',
    'navigate("/marketplace")',
  ]) &&
    ["项目驾驶舱", "告警 Feed", "多智能体协作中枢", "智能体矩阵", "dashboard-map"].every(
      (item) => !home.includes(item),
    ),
  "home source is a minimal chat workbench and does not carry legacy dashboard, map, or agent-hub copy",
)

check(
  "visual regression E2E",
  has(visual, [
    "[data-testid=home-workbench]",
    "[data-testid=home-chat-composer]",
    "想让 RAILWISE 完成什么？",
    "项目驾驶舱",
    "告警 Feed",
    "多智能体协作中枢",
    "智能体矩阵",
    "[data-testid=dashboard-map]",
  ]),
  "old dashboard, map, and agent-hub copy are blocked while the minimalist home composer is asserted",
)
check(
  "TTFUI E2E budget",
  has(ttfui, [
    "Date.now()",
    "[data-testid=app-shell]",
    "[data-testid=sidecar-status]",
    "toBeLessThan(15000)",
    "__RW_PERF__",
  ]),
  "TTFUI asserts shell, sidecar, perf marker, and <15s usability budget",
)
check(
  "Playwright artifacts",
  has(config, [
    "e2e/playwright-report",
    'trace: "on-first-retry"',
    'screenshot: "only-on-failure"',
    'video: "retain-on-failure"',
  ]) &&
    has(config, [
      'process.platform === "darwin"',
      "zsh -lc",
      "bun ./node_modules/vite/bin/vite.js",
      "Library/Caches/ms-playwright",
      "Google Chrome for Testing",
      "PLAYWRIGHT_CHROMIUM_CHANNEL",
    ]) &&
    config.includes("channel ? undefined") &&
    has(acceptance, [
      "const channel = Bun.env.PLAYWRIGHT_CHROMIUM_CHANNEL",
      "channel\n    ? undefined",
      "reachable ? \"1\" : undefined",
      "PLAYWRIGHT_SKIP_WEBSERVER",
    ]) &&
    !acceptance.includes("reachable || live ?"),
  "HTML report, trace, screenshot, video artifacts, and the stable macOS Vite webServer command are configured",
)
check(
  "telemetry default off",
  has(settings, ["telemetry: false", "telemetryPrompted: false"]) &&
    has(consent, [
      'platform.platform !== "desktop"',
      "browserHarness",
      "telemetryPrompted",
      "railwise:telemetry-enabled",
    ]),
  "desktop consent gates telemetry and defaults to disabled",
)
check(
  "telemetry settings control",
  has(general, [
    "settings.privacy.setTelemetry",
    "settings.privacy.setTelemetryPrompted(true)",
    "railwise:telemetry-enabled",
  ]),
  "privacy settings can enable or disable telemetry",
)
check(
  "telemetry local queue",
  has(store, [
    "sqlite:railwise.telemetry.db",
    "telemetry_events",
    "telemetry_state",
    "if (!(await isEnabled())) return",
    "DELETE FROM telemetry_events",
  ]),
  "events are stored locally only when enabled and cleared on disable",
)
check(
  "telemetry sanitization",
  has(privacy, ["prompt", "filename", "path", "token", "secret", "[redacted]"]) &&
    has(telemetry, ["desktop_error", "captureError", "startBatcher"]),
  "prompt, file, path, token, and secret-like values are redacted",
)
check(
  "user docs",
  missingUserDocs.length === 0,
  missingUserDocs.length === 0 ? `${userDocs.length} user docs exist` : `missing: ${missingUserDocs.join(", ")}`,
)
check(
  "admin docs",
  missingAdminDocs.length === 0,
  missingAdminDocs.length === 0 ? `${adminDocs.length} admin docs exist` : `missing: ${missingAdminDocs.join(", ")}`,
)
check(
  "developer docs",
  missingDevDocs.length === 0 && (await exists("docs/dev/06-m7-acceptance.md")),
  missingDevDocs.length === 0 ? "developer docs and M7 record exist" : `missing: ${missingDevDocs.join(", ")}`,
)
check(
  "M7 acceptance record",
  has(docs, ["12 条核心 E2E", "视觉回归", "TTFUI", "bun run desktop:verify", "--full"]),
  "acceptance record links E2E, visual, TTFUI, and full verify command",
)

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} M7 acceptance check(s) failed.`)
  process.exit(1)
}

console.log(`\nDesktop M7 acceptance readiness passed (${checks.length} checks).`)
