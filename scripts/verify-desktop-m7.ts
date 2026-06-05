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
  "12-desktop-harness-marketplace-beta.md",
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
const marketplaceState = await read("packages/app/src/pages/marketplace/marketplace-state.ts")
const marketplaceStateTest = await read("packages/app/src/pages/marketplace/marketplace-state.test.ts")
const agentsPage = await read("packages/app/src/pages/agents/index.tsx")
const agentDetail = await read("packages/app/src/pages/agents/[name].tsx")
const agentCollaborationTest = await read("packages/app/src/pages/agents/collaboration.test.ts")
const agentDisplay = await read("packages/app/src/utils/agent-display.ts")
const agentDisplayTest = await read("packages/app/src/utils/agent-display.test.ts")
const sessionComposer = await read("packages/app/src/pages/session/composer/session-composer-region.tsx")
const sessionCollaboration = await read("packages/app/src/pages/session/composer/collaboration.ts")
const promptInput = await read("packages/app/src/components/prompt-input.tsx")
const config = await read("packages/desktop/playwright.config.ts")
const acceptance = await read("scripts/verify-desktop-acceptance.ts")
const consent = await read("packages/app/src/components/telemetry-consent.tsx")
const settings = await read("packages/app/src/context/settings.tsx")
const general = await read("packages/app/src/components/settings-general.tsx")
const agentsSettings = await read("packages/app/src/components/settings-agents.tsx")
const telemetry = await read("packages/desktop/src/lib/telemetry/index.ts")
const store = await read("packages/desktop/src/lib/telemetry/store.ts")
const privacy = await read("packages/desktop/src/lib/telemetry/privacy.ts")
const macSmoke = await read("packages/desktop/scripts/smoke-macos-app.ts")
const harnessSchema = await read("packages/railwise/src/harness/schema.ts")
const harnessService = await read("packages/railwise/src/harness/service.ts")
const marketplaceSchema = await read("packages/railwise/src/marketplace/schema.ts")
const marketplaceService = await read("packages/railwise/src/marketplace/service.ts")
const marketplaceBuiltin = await read("packages/railwise/src/marketplace/builtin.ts")
const chief = await read("packages/railwise/agent/chief_manager.md")
const cpiii = await read("packages/railwise/agent/cpiii_specialist.md")
const reviewer = await read("packages/railwise/agent/qa_reviewer.md")
const harnessRoute = await read("packages/railwise/src/server/routes/harness.ts")
const marketplaceRoute = await read("packages/railwise/src/server/routes/marketplace.ts")
const server = await read("packages/railwise/src/server/server.ts")
const sdk = await read("packages/sdk/js/src/v2/gen/sdk.gen.ts")
const sdkTypes = await read("packages/sdk/js/src/v2/gen/types.gen.ts")
const docs = await read("docs/dev/06-m7-acceptance.md")
const betaQa = await read("docs/dev/12-desktop-harness-marketplace-beta.md")
const docsUser = [await read("docs/user/03-agents.md"), await read("docs/user/07-skills.md")].join("\n")
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
    "multiple: false",
    "DialogSelectDirectory multiple={false}",
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
      "marketplace-permissions-${selected().id}",
      "sdk.client.marketplace.capabilities.list()",
      "useGlobalSDK",
    ]) &&
    !marketplace.includes("marketplace-grid") &&
    !marketplace.includes("marketplace-provider-strip") &&
    !marketplace.includes("marketplace-card") &&
    !marketplace.includes("agent-collaboration-start") &&
    !marketplace.includes("agent-model-routing") &&
    has(agentStudio, ['launchApp("/marketplace"', 'launchApp("/agents"', "toHaveCount(0)", "agent-collaboration-start"]),
  "marketplace stays as one concise registry plus detail panel while /agents keeps advanced management",
)
check(
  "desktop product language",
  ["项目总控", "总控", "主控智能体", "主控、审校", "总工程师", "总工"].every(
    (item) =>
      ![home, marketplace, agentsPage, settings, agentsSettings, chief, cpiii, reviewer, docsUser].join("\n").includes(item),
  ) &&
    chief.includes("RAILWISE 默认协作") &&
    chief.includes("【协作汇总交付物】") &&
    !desktopLanguageDocs.includes("Agent Studio") &&
    !desktopLanguageDocs.includes("Harness Profile") &&
    !desktopLanguageDocs.includes("工具/Skills") &&
    !e2eHelper.includes("Skills 加载") &&
    !agentCollaborationTest.includes("Agent Studio") &&
    !sessionCollaboration.includes("Skill「") &&
    sessionCollaboration.includes("请使用技能") &&
    agentsPage.includes("RAILWISE 协作") &&
    agentsPage.includes("agent-collaboration-start") &&
    agentsPage.includes("模型接入与智能体路由") &&
    agentsPage.includes("<h2>智能体</h2>") &&
    agentsPage.includes("#agent-library") &&
    agentDetail.includes('data-testid="agent-capability-routing"') &&
    agentDetail.includes("可调用能力") &&
    agentDetail.includes("capabilitiesForAgent") &&
    agentDisplay.includes('qa_reviewer: "质量审查"') &&
    agentDisplay.includes('technical_writer: "报告编制"') &&
    agentDisplayTest.includes('agentDisplayName("solution_architect")') &&
    !agentsPage.includes("RAILWISE 高级智能体管理") &&
    !agentsPage.includes("上下文文件夹") &&
    !agentsPage.includes("RAILWISE 能力市场") &&
    !agentsPage.includes("项目工作区") &&
    !agentsPage.includes("智能体矩阵") &&
    !(await exists("packages/desktop/e2e/04-agent-studio.spec.ts")),
  "Desktop docs, E2E fixtures, and advanced management page use concise collaboration, skill, and execution-layer language",
)

check(
  "marketplace inventory state",
  has(e2eHelper, [
      "/marketplace/capabilities",
      "/agent-studio/tool/list",
      "/agent-studio/skill/list",
      "railwise.agent.chief_manager",
      "railwise.provider.deepseek",
      "规范条文查询",
      "monitoring-design",
    ]) &&
    has(agentStudio, [
      "marketplace-row-state-agents",
      "marketplace-row-state-tools",
      "marketplace-row-state-skills",
      "marketplace-row-state-providers",
      "marketplace-preview-tools",
      "marketplace-preview-skills",
      "marketplace-permissions-agents",
      "marketplace-permissions-tools",
      "marketplace-permissions-skills",
      "marketplace-permissions-providers",
      "marketplace-capability-bindings",
      "规范资料管理员",
      "质量审查专家",
      "规范引用复核",
      "agent-capability-routing",
      "网络 / 密钥",
      "执行层",
      "技能",
    ]) &&
    has(visual, ["agent-capability-routing", "可调用能力", "规范条文速查"]) &&
    has(marketplaceState, ["capabilitiesForAgent", "agentCapabilityLabels", "规范资料管理员", "规范引用复核", "permissionSummary", "riskLabel", "sourceLabel", "harness_profile"]) &&
    has(marketplaceStateTest, ["maps agents back to callable capabilities", "规范资料管理员", "网络 / 密钥", "DeepSeek", "RAILWISE 默认协作"]) &&
    !marketplace.includes("label: \"Agents\"") &&
    !marketplace.includes("label: \"Tools\"") &&
    !marketplace.includes("label: \"Skills\""),
  "marketplace asserts enabled inventory state for agents, tools, skills, and provider setup",
)
check(
  "backend harness marketplace contract",
  has(harnessSchema, ["HarnessStatus", "HarnessEventType", "tool.started", "permission.resolved"]) &&
    has(harnessService, ["export namespace Harness", "await Marketplace.list()", "resolvePermission"]) &&
    has(marketplaceSchema, ["CapabilityManifest", "harness_profile", "CapabilityPermission"]) &&
    has(marketplaceService, [
      "export namespace Marketplace",
      "Storage.read",
      "Storage.write",
      "CapabilityManifest.parse",
      "CapabilityGroup.parse",
      "export async function enable",
      "export async function disable",
    ]) &&
    has(marketplaceBuiltin, ["railwise.agent.chief_manager", "railwise.provider.deepseek", "railwise.harness.safe"]) &&
    has(harnessRoute, ["/status", "/session/:sessionID/timeline", "/session/:sessionID/permission/:permissionID"]) &&
    has(marketplaceRoute, ["await Marketplace.list()", "Marketplace.enable", "Marketplace.disable", "/capabilities", "/capabilities/:id", "/capabilities/:id/enable", "/capabilities/:id/disable"]) &&
    has(server, ['.route("/harness", HarnessRoutes())', '.route("/marketplace", MarketplaceRoutes())']) &&
    has(sdk, [
      "get harness()",
      "get marketplace()",
      "postMarketplaceCapabilitiesIdEnable",
      "postMarketplaceCapabilitiesIdDisable",
      'url: "/harness/status"',
      'url: "/marketplace/capabilities"',
    ]) &&
    has(sdkTypes, ["export type HarnessStatus", "export type CapabilityManifest"]),
  "backend exposes Harness runtime and Marketplace capability contracts through server routes and SDK",
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
    "开始协作",
    'navigate("/harness")',
    'navigate("/marketplace")',
  ]) &&
    !home.includes("DialogSelectDirectory multiple={true}") &&
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
    "heading\", { name: \"RAILWISE\"",
    "想让 RAILWISE 完成什么？",
    "选择项目",
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
  "macOS launch smoke readiness",
  has(macSmoke, ["CLI health check OK", "--ready-timeout", "railwise-desktop_", "--skip-ready", "--skip-process-check"]) &&
    has(docs, ["macOS 启动烟测", "bun run smoke:macos -- --ready-timeout 90", "CLI health check OK"]),
  "macOS app smoke covers bundle verification, process launch, and sidecar readiness in normal Terminal",
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
check(
  "desktop beta QA checklist",
  has(betaQa, [
    "Desktop Harness Marketplace Beta QA",
    "macOS Apple Silicon",
    "macOS Intel",
    "Linux：不做 Desktop 安装包",
    "首屏是 Workbench",
    "没有大面积 `0` 计数器",
    "选择项目",
    "本地文件夹",
    "执行层显示工作区边界",
    "RAILWISE 默认协作",
    "本地文件读取",
    "复测资料检查",
    "DeepSeek",
    "browserType.launch",
    "不得发布 Beta",
  ]),
  "manual beta QA covers platform scope, workbench, harness, marketplace manifests, browser failure triage, and blockers",
)

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} M7 acceptance check(s) failed.`)
  process.exit(1)
}

console.log(`\nDesktop M7 acceptance readiness passed (${checks.length} checks).`)
