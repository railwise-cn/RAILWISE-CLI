#!/usr/bin/env bun

import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const exists = async (...parts: string[]) => Bun.file(file(...parts)).exists()
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const lacks = (text: string, values: string[]) => values.every((value) => !text.includes(value))
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
  "06-m7-acceptance.md",
]
const missing = async (base: string, files: string[]) =>
  (
    await Promise.all(files.map(async (name) => ((await exists(base, name)) ? undefined : path.join(base, name))))
  ).filter((item): item is string => Boolean(item))

const missingSpecs = await missing("packages/desktop/e2e", specs)
const missingUserDocs = await missing("docs/user", userDocs)
const missingAdminDocs = await missing("docs/admin", adminDocs)
const missingDevDocs = await missing("docs/dev", devDocs)
const startup = await read("packages/desktop/e2e/01-startup.spec.ts")
const marketplaceSpec = await read("packages/desktop/e2e/04-capability-marketplace.spec.ts")
const visual = await read("packages/desktop/e2e/11-visual-regression.spec.ts")
const ttfui = await read("packages/desktop/e2e/12-ttfui.spec.ts")
const helper = await read("packages/desktop/e2e/helpers/app.ts")
const app = await read("packages/app/src/app.tsx")
const workbench = await read("packages/app/src/pages/workbench/index.tsx")
const marketplace = await read("packages/app/src/pages/marketplace/index.tsx")
const marketplaceState = await read("packages/app/src/pages/marketplace/marketplace-state.ts")
const agents = await read("packages/app/src/pages/agents/index.tsx")
const settingsAgents = await read("packages/app/src/components/settings-agents.tsx")
const harness = await read("packages/app/src/pages/harness/index.tsx")
const harnessSchema = await read("packages/railwise/src/harness/schema.ts")
const harnessService = await read("packages/railwise/src/harness/service.ts")
const marketplaceSchema = await read("packages/railwise/src/marketplace/schema.ts")
const marketplaceBuiltin = await read("packages/railwise/src/marketplace/builtin.ts")
const marketplaceRoute = await read("packages/railwise/src/server/routes/marketplace.ts")
const server = await read("packages/railwise/src/server/server.ts")
const config = await read("packages/desktop/playwright.config.ts")
const acceptance = await read("scripts/verify-desktop-acceptance.ts")
const consent = await read("packages/app/src/components/telemetry-consent.tsx")
const settings = await read("packages/app/src/context/settings.tsx")
const general = await read("packages/app/src/components/settings-general.tsx")
const telemetry = await read("packages/desktop/src/lib/telemetry/index.ts")
const store = await read("packages/desktop/src/lib/telemetry/store.ts")
const privacy = await read("packages/desktop/src/lib/telemetry/privacy.ts")
const docs = await read("docs/dev/06-m7-acceptance.md")

check(
  "M7 E2E spec inventory",
  missingSpecs.length === 0 && !(await exists("packages/desktop/e2e/04-agent-studio.spec.ts")),
  missingSpecs.length === 0
    ? `${specs.length} required specs exist and legacy Agent Studio spec is removed`
    : `missing: ${missingSpecs.join(", ")}`,
)
check(
  "startup lands on workbench",
  has(startup, ["[data-testid=sidecar-status]", '"ready"', "15000", "workbench-page", "告诉 RAILWISE 你想完成什么"]) &&
    lacks(startup, ["Agent Studio", "项目工作区", "智能体矩阵"]),
  "startup waits for sidecar ready and lands on the Codex-style workbench within 15s",
)
check(
  "workbench is chat-first",
  has(workbench, [
    'data-testid="workbench-page"',
    "告诉 RAILWISE 你想完成什么",
    "选择资料目录",
    "collaborationTarget",
    "setSessionHandoff",
    "最近工作区",
    "会话产物",
    "能力市场",
    "Harness",
    "高级智能体设置",
  ]) && lacks(workbench, ["多智能体协作中枢", "项目驾驶舱", "告警 Feed", "dashboard-map"]),
  "home route uses Workbench v2 instead of the old project dashboard",
)
check(
  "marketplace is independent",
  has(app, ["const MarketplaceRoute", "const HarnessRoute", "const AgentsIndexRoute"]) &&
    has(marketplace, [
      'data-testid="marketplace-page"',
      "能力市场",
      "sdk.client.marketplace.capabilities",
      ".list()",
      "filterCapabilities",
      "groupCapabilities",
      "permissionLabels",
    ]) &&
    lacks(marketplace, ["agent-collaboration-start", "agent-model-routing", "项目工作区", "智能体矩阵"]),
  "marketplace keeps capability installation/configuration separate from task collaboration",
)
check(
  "marketplace E2E mocks capabilities",
  has(helper, [
    "/marketplace/capabilities",
    "railwise.agent.chief_manager",
    "railwise.provider.deepseek",
    "复测资料检查",
    "secrets: true",
  ]) &&
    has(marketplaceSpec, [
      "能力市场",
      "项目总控",
      "本地文件读取",
      "复测资料检查",
      "DeepSeek",
      "agent-collaboration-start",
    ]),
  "browser tests cover capability cards, permissions, providers, and no collaboration form on marketplace",
)
check(
  "advanced agent settings language",
  has(agents, ["RAILWISE 高级智能体管理", "高级智能体管理", "上下文文件夹", "智能体库", "模型接入与智能体路由"]) &&
    has(settingsAgents, ["高级管理"]) &&
    lacks(agents, ["RAILWISE Agent Studio", "多智能体协作中枢", "项目工作区", "智能体矩阵"]),
  "agents route is advanced management, not the primary product surface",
)
check(
  "harness surface exists",
  has(harness, ["运行时控制台", 'data-testid="harness-page"', "权限", "轨迹"]) &&
    has(harnessSchema, ["HarnessStatus", "HarnessEventType", "permission.resolved"]) &&
    has(harnessService, ["export namespace Harness", "resolvePermission"]),
  "desktop exposes a visible Harness execution layer",
)
check(
  "backend marketplace contract",
  has(marketplaceSchema, ["CapabilityManifest", "CapabilityPermission", "harness_profile"]) &&
    has(marketplaceState, ["permissionLabels", "capabilityRisk", "filterCapabilities", "groupCapabilities"]) &&
    has(marketplaceBuiltin, ["railwise.agent.chief_manager", "railwise.provider.deepseek", "railwise.harness.safe"]) &&
    has(marketplaceRoute, [
      "/capabilities",
      "/capabilities/:id",
      "/capabilities/:id/enable",
      "/capabilities/:id/disable",
    ]) &&
    has(server, ['.route("/marketplace", MarketplaceRoutes())']),
  "server exposes marketplace routes and built-in capability manifests",
)
check(
  "visual regression blocks legacy surfaces",
  has(visual, [
    "workbench-page",
    "告诉 RAILWISE 你想完成什么",
    "多智能体协作中枢",
    "项目工作区",
    "智能体矩阵",
    "dashboard-map",
  ]),
  "visual regression asserts old dashboard and agent-hub language stay absent",
)
check(
  "TTFUI budget",
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
  ]) && has(acceptance, ["PLAYWRIGHT_SKIP_WEBSERVER", "PLAYWRIGHT_BASE_URL"]),
  "HTML report, trace, screenshot, video artifacts, and live-check env wiring are configured",
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
  has(store, ["sqlite:railwise.telemetry.db", "telemetry_events", "telemetry_state", "DELETE FROM telemetry_events"]) &&
    has(privacy, ["prompt", "filename", "path", "token", "secret", "[redacted]"]) &&
    has(telemetry, ["desktop_error", "captureError", "startBatcher"]),
  "telemetry is local, opt-in, and sanitizes sensitive values",
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
  missingDevDocs.length === 0,
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
