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
  "04-agent-studio.spec.ts",
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
const agentStudio = await read("packages/desktop/e2e/04-agent-studio.spec.ts")
const e2eHelper = await read("packages/desktop/e2e/helpers/app.ts")
const visual = await read("packages/desktop/e2e/11-visual-regression.spec.ts")
const ttfui = await read("packages/desktop/e2e/12-ttfui.spec.ts")
const app = await read("packages/app/src/app.tsx")
const home = await read("packages/app/src/pages/home.tsx")
const marketplace = await read("packages/app/src/pages/marketplace/index.tsx")
const sessionComposer = await read("packages/app/src/pages/session/composer/session-composer-region.tsx")
const promptInput = await read("packages/app/src/components/prompt-input.tsx")
const config = await read("packages/desktop/playwright.config.ts")
const consent = await read("packages/app/src/components/telemetry-consent.tsx")
const settings = await read("packages/app/src/context/settings.tsx")
const general = await read("packages/app/src/components/settings-general.tsx")
const telemetry = await read("packages/desktop/src/lib/telemetry/index.ts")
const store = await read("packages/desktop/src/lib/telemetry/store.ts")
const privacy = await read("packages/desktop/src/lib/telemetry/privacy.ts")
const docs = await read("docs/dev/06-m7-acceptance.md")

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
    has(startup, [
      "[data-testid=home-project-directory]",
      "[data-testid=home-task-input]",
      "[data-testid=home-start-session]",
      "[data-testid=session-collaboration-panel]",
      "[data-testid=session-model-readiness]",
      "[data-testid=session-model-setup]",
      "[data-testid=session-prompt-input]",
      "chief_manager",
    ]),
  "home creates a chief_manager handoff and the session composer receives it as the primary collaboration path",
)
check(
  "marketplace separated from advanced agent management",
  has(app, ["const AgentsIndexRoute", "<AgentsIndex />", "const MarketplaceRoute"]) &&
    has(marketplace, [
      'data-testid="marketplace-page"',
      "marketplace-card",
      "marketplace-open-${item.id}",
      "marketplace-card-state-${item.id}",
      "marketplace-preview-${selected().id}",
    ]) &&
    !marketplace.includes("agent-collaboration-start") &&
    !marketplace.includes("agent-model-routing") &&
    has(agentStudio, ['launchApp("/marketplace")', 'launchApp("/agents")', "toHaveCount(0)", "agent-collaboration-start"]),
  "marketplace stays as a concise capability market while /agents keeps advanced management",
)
check(
  "marketplace inventory state",
  has(e2eHelper, ["/agent-studio/tool/list", "/agent-studio/skill/list", "规范条文查询", "monitoring-design"]) &&
    has(agentStudio, [
      "marketplace-card-state-agents",
      "marketplace-card-state-tools",
      "marketplace-card-state-skills",
      "marketplace-card-state-providers",
      "marketplace-preview-tools",
      "marketplace-preview-skills",
    ]),
  "marketplace asserts enabled inventory state for agents, tools, skills, and provider setup",
)
check(
  "visual regression E2E",
  has(visual, ["[data-testid=home-workbench]", "想让 RAILWISE 完成什么？", "项目驾驶舱", "告警 Feed", "[data-testid=dashboard-map]"]),
  "old dashboard copy and map are blocked while the minimalist home workbench is asserted",
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
  ]),
  "HTML report, trace, screenshot, and video artifacts are configured",
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
