# RAILWISE Desktop Codex-Style Harness + Marketplace Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild RAILWISE Desktop into a Codex-style local AI workbench with a clear Harness runtime, marketplace extensibility, and a simple chat-first workspace experience.

**Architecture:** The Desktop app becomes a thin macOS/Windows shell around a workspace-first web app. The backend owns Harness state, capability manifests, permission policy, and event history. The frontend renders three primary surfaces: Workbench, Harness Timeline, and Marketplace.

**Tech Stack:** Tauri 2, SolidJS, Vite, Bun, TypeScript, Hono routes, existing RAILWISE session/project/plugin/skill/tool services.

---

## Product Decision

The current Desktop screen looks like an Agent Studio administration page. That is the wrong shape for an AI product. Users should not open the app and see large counters, model matrices, empty tool lists, and management panels. They should open a workspace, describe work, and see RAILWISE execute through a visible Harness.

The new product model is:

```text
User opens folder
  -> User chats with RAILWISE
  -> Harness plans work
  -> Harness routes to agents/models/skills/tools
  -> Permission gate approves risky actions
  -> Tools run and emit events
  -> Files/reports/artifacts appear in the session
```

Codex is the reference product pattern:

- Chat is the main control surface.
- Project folder is the context.
- Tool calls are visible but not overwhelming.
- Permissions are explicit.
- Extensions are discoverable through a marketplace-like capability system.
- Runtime Harness is a product concept, not hidden glue.

## Non-Goals For This Milestone

- No paid marketplace.
- No online plugin review workflow.
- No team management.
- No cloud sync.
- No Windows code signing requirement for internal testing.
- No full replacement of the existing session engine.

## Acceptance Criteria

- Desktop launches to a clean workbench, not the existing Agent Studio dashboard.
- First viewport contains no big `0` counters.
- User can select a local folder and start a session from a single chat composer.
- User can see Harness mode, active model, active capability set, and permission posture.
- Tool calls are shown in a timeline with status, duration, and risk level.
- Marketplace page lists installable or built-in Agents, Tools, Skills, Workflows, MCP Connectors, Model Providers, and Harness Profiles.
- Each marketplace item shows permissions before enable/install.
- Existing `/agents` route is demoted to an advanced capability view or redirects to Marketplace.
- Main UI language is Chinese.
- Tests run from package directories, not repo root.

## File Structure Map

### Backend Contracts

- Create `packages/railwise/src/harness/schema.ts`
  - Owns Harness event, mode, status, permission, and artifact schemas.
- Create `packages/railwise/src/harness/service.ts`
  - Aggregates session events and capability state for the UI.
- Create `packages/railwise/test/harness/schema.test.ts`
  - Verifies schema parsing and default runtime state.
- Create `packages/railwise/test/harness/service.test.ts`
  - Verifies event aggregation and empty-state behavior.

### Marketplace Contracts

- Create `packages/railwise/src/marketplace/schema.ts`
  - Defines capability manifest format.
- Create `packages/railwise/src/marketplace/builtin.ts`
  - Lists built-in RAILWISE capabilities shipped in Desktop.
- Create `packages/railwise/src/marketplace/service.ts`
  - Merges built-ins, installed skills, tools, and providers into one registry.
- Create `packages/railwise/test/marketplace/service.test.ts`
  - Verifies category grouping and permission metadata.

### Server Routes

- Create `packages/railwise/src/server/routes/harness.ts`
  - `GET /harness/status`
  - `GET /harness/session/:sessionID/timeline`
  - `POST /harness/session/:sessionID/permission/:permissionID`
- Create `packages/railwise/src/server/routes/marketplace.ts`
  - `GET /marketplace/capabilities`
  - `GET /marketplace/capabilities/:id`
  - `POST /marketplace/capabilities/:id/enable`
  - `POST /marketplace/capabilities/:id/disable`
- Modify `packages/railwise/src/server/server.ts`
  - Register new routes.
- Regenerate SDK with `./packages/sdk/js/script/build.ts` after routes are stable.

### Frontend Workbench

- Create `packages/app/src/pages/workbench/index.tsx`
  - Codex-style main workspace page.
- Create `packages/app/src/pages/workbench/workbench.css`
  - Three-pane layout: sidebar, chat, context panel.
- Create `packages/app/src/pages/workbench/workbench-state.ts`
  - Pure helpers for empty state, selected folder, and session handoff.
- Create `packages/app/src/pages/workbench/workbench-state.test.ts`
  - Unit tests for UI state derivation.
- Modify `packages/app/src/app.tsx`
  - Add `/home`, `/marketplace`, `/harness`, keep `/agents` advanced route.

### Harness UI

- Create `packages/app/src/pages/harness/index.tsx`
  - Harness diagnostic page.
- Create `packages/app/src/components/harness-status.tsx`
  - Compact right-panel status widget.
- Create `packages/app/src/components/harness-timeline.tsx`
  - Timeline of plan/tool/permission/artifact events.
- Create `packages/app/src/components/harness-permission-card.tsx`
  - Explicit permission approval UI.
- Create `packages/app/src/components/harness-timeline.test.tsx`
  - Timeline rendering tests.

### Marketplace UI

- Create `packages/app/src/pages/marketplace/index.tsx`
  - Capability marketplace.
- Create `packages/app/src/pages/marketplace/marketplace.css`
  - Dense, quiet, Codex-like capability browser.
- Create `packages/app/src/pages/marketplace/marketplace-state.ts`
  - Filtering and grouping helpers.
- Create `packages/app/src/pages/marketplace/marketplace-state.test.ts`
  - Unit tests for category and permission labels.

### Desktop Shell

- Modify `packages/desktop/src/index.tsx`
  - Default path `/home`.
- Modify `packages/desktop/src-tauri/src/windows.rs`
  - Default webview URL `/#/home`.
- Modify `packages/desktop/e2e/01-startup.spec.ts`
  - Assert Desktop opens Workbench, not Agent Studio dashboard.

## UX Specification

### Main Workbench

```text
┌───────────────────────────────────────────────────────────────┐
│ RAILWISE                                                       │
├───────────────┬──────────────────────────────┬────────────────┤
│ 工作区          │ 对话                           │ Harness        │
│ 打开资料目录     │ 你想完成什么？                  │ 本地安全模式     │
│ 最近会话        │ [ 输入任务...              ]    │ 当前模型         │
│ Marketplace   │                                │ 已启用能力       │
│ Settings      │ 工具调用 / 文件变更 / 产物          │ 权限状态         │
└───────────────┴──────────────────────────────┴────────────────┘
```

No large statistics cards are allowed on this screen. If data is unavailable, the UI should show a next action:

- "选择资料目录后，RAILWISE 会加载可用智能体和工具。"
- "模型尚未接入，仍可先用本地资料检查流程。"
- "当前没有危险权限请求。"

### Marketplace

Capability categories:

- 智能体 Agents
- 工具 Tools
- Skills 专业流程
- 工作流 Workflows
- MCP Connectors
- 模型 Providers
- Harness Profiles

Each card must show:

- Name
- Description
- Installed/enabled state
- Permission badges
- Source: built-in, local, remote
- Version
- Risk level

### Harness

Harness is shown in two places:

- Compact right panel in Workbench.
- Full diagnostic page at `/harness`.

Harness event types:

```ts
type HarnessEventType =
  | "session.started"
  | "plan.created"
  | "agent.selected"
  | "model.selected"
  | "skill.loaded"
  | "tool.requested"
  | "permission.requested"
  | "permission.resolved"
  | "tool.started"
  | "tool.completed"
  | "tool.failed"
  | "artifact.created"
  | "session.completed"
```

## Data Contract Draft

### Capability Manifest

```ts
export const CapabilityKind = z.enum([
  "agent",
  "tool",
  "skill",
  "workflow",
  "mcp",
  "provider",
  "harness_profile",
])

export const CapabilityPermission = z.object({
  filesystem: z.enum(["none", "read", "write"]).default("none"),
  network: z.boolean().default(false),
  shell: z.boolean().default(false),
  external_directory: z.boolean().default(false),
  secrets: z.boolean().default(false),
})

export const CapabilityManifest = z.object({
  id: z.string(),
  kind: CapabilityKind,
  name: z.string(),
  description: z.string(),
  version: z.string(),
  source: z.enum(["builtin", "local", "remote"]),
  enabled: z.boolean(),
  installed: z.boolean(),
  permissions: CapabilityPermission,
  tags: z.string().array().default([]),
})
```

### Harness Status

```ts
export const HarnessMode = z.enum(["safe", "ask", "auto"])
export const HarnessStatus = z.object({
  mode: HarnessMode,
  workspace: z.string().optional(),
  model: z.string().optional(),
  activeAgent: z.string().optional(),
  capabilityCount: z.number().int(),
  pendingPermissionCount: z.number().int(),
  runningToolCount: z.number().int(),
})
```

## Task 1: Backend Harness Schemas

**Files:**

- Create: `packages/railwise/src/harness/schema.ts`
- Create: `packages/railwise/src/harness/index.ts`
- Create: `packages/railwise/test/harness/schema.test.ts`

- [ ] **Step 1: Write schema tests**

```ts
import { describe, expect, test } from "bun:test"
import { HarnessEvent, HarnessStatus } from "../../src/harness"

describe("Harness schema", () => {
  test("parses a default safe status without showing fake zero UI data", () => {
    const status = HarnessStatus.parse({
      mode: "safe",
      capabilityCount: 0,
      pendingPermissionCount: 0,
      runningToolCount: 0,
    })

    expect(status.mode).toBe("safe")
    expect(status.capabilityCount).toBe(0)
  })

  test("parses a tool lifecycle event", () => {
    const event = HarnessEvent.parse({
      id: "evt_01",
      sessionID: "ses_01",
      type: "tool.started",
      title: "读取工程目录",
      createdAt: 1779498000000,
      risk: "low",
    })

    expect(event.type).toBe("tool.started")
  })
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd packages/railwise
bun test test/harness/schema.test.ts
```

Expected: fail because `../../src/harness` does not exist.

- [ ] **Step 3: Implement schemas**

Create `packages/railwise/src/harness/schema.ts` with:

```ts
import z from "zod"

export const HarnessMode = z.enum(["safe", "ask", "auto"])
export const HarnessRisk = z.enum(["low", "medium", "high"])
export const HarnessEventType = z.enum([
  "session.started",
  "plan.created",
  "agent.selected",
  "model.selected",
  "skill.loaded",
  "tool.requested",
  "permission.requested",
  "permission.resolved",
  "tool.started",
  "tool.completed",
  "tool.failed",
  "artifact.created",
  "session.completed",
])

export const HarnessEvent = z.object({
  id: z.string(),
  sessionID: z.string(),
  type: HarnessEventType,
  title: z.string(),
  detail: z.string().optional(),
  createdAt: z.number().int(),
  duration: z.number().int().optional(),
  risk: HarnessRisk.default("low"),
  capabilityID: z.string().optional(),
  artifactPath: z.string().optional(),
  error: z.string().optional(),
})

export const HarnessStatus = z.object({
  mode: HarnessMode,
  workspace: z.string().optional(),
  model: z.string().optional(),
  activeAgent: z.string().optional(),
  capabilityCount: z.number().int(),
  pendingPermissionCount: z.number().int(),
  runningToolCount: z.number().int(),
})

export type HarnessEvent = z.infer<typeof HarnessEvent>
export type HarnessStatus = z.infer<typeof HarnessStatus>
```

Create `packages/railwise/src/harness/index.ts` with:

```ts
export * from "./schema"
```

- [ ] **Step 4: Verify**

Run:

```bash
cd packages/railwise
bun test test/harness/schema.test.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/railwise/src/harness packages/railwise/test/harness/schema.test.ts
git commit -m "feat(harness): add runtime schemas"
```

## Task 2: Marketplace Capability Registry

**Files:**

- Create: `packages/railwise/src/marketplace/schema.ts`
- Create: `packages/railwise/src/marketplace/builtin.ts`
- Create: `packages/railwise/src/marketplace/service.ts`
- Create: `packages/railwise/src/marketplace/index.ts`
- Create: `packages/railwise/test/marketplace/service.test.ts`

- [ ] **Step 1: Write service tests**

```ts
import { describe, expect, test } from "bun:test"
import { Marketplace } from "../../src/marketplace"

describe("Marketplace service", () => {
  test("lists built-in RAILWISE capabilities with permission metadata", () => {
    const list = Marketplace.builtins()

    expect(list.length).toBeGreaterThan(0)
    expect(list.some((item) => item.kind === "harness_profile")).toBe(true)
    expect(list.every((item) => item.permissions)).toBe(true)
  })

  test("groups capabilities by product category", () => {
    const groups = Marketplace.groups(Marketplace.builtins())

    expect(groups.map((group) => group.kind)).toContain("agent")
    expect(groups.map((group) => group.kind)).toContain("tool")
    expect(groups.map((group) => group.kind)).toContain("skill")
  })
})
```

- [ ] **Step 2: Run failing tests**

Run:

```bash
cd packages/railwise
bun test test/marketplace/service.test.ts
```

Expected: fail because marketplace module does not exist.

- [ ] **Step 3: Implement schema**

Create `packages/railwise/src/marketplace/schema.ts` with the `CapabilityKind`, `CapabilityPermission`, and `CapabilityManifest` contracts from the Data Contract Draft section.

- [ ] **Step 4: Implement built-ins**

Create `packages/railwise/src/marketplace/builtin.ts` with at least these built-in capabilities:

```ts
import type { CapabilityManifest } from "./schema"

export const builtins: CapabilityManifest[] = [
  {
    id: "railwise.harness.safe",
    kind: "harness_profile",
    name: "本地安全模式",
    description: "默认要求用户确认写文件、执行命令和访问外部目录。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    },
    tags: ["安全", "默认"],
  },
  {
    id: "railwise.agent.chief_manager",
    kind: "agent",
    name: "项目总控",
    description: "理解任务、拆解计划，并调度专业智能体执行。",
    version: "0.1.0",
    source: "builtin",
    enabled: true,
    installed: true,
    permissions: {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    },
    tags: ["主控", "调度"],
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
    permissions: {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    },
    tags: ["测绘", "资料检查"],
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
    permissions: {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    },
    tags: ["文件", "本地"],
  },
]
```

- [ ] **Step 5: Implement service**

Create `packages/railwise/src/marketplace/service.ts` with:

```ts
import { builtins } from "./builtin"
import type { CapabilityManifest } from "./schema"

export namespace Marketplace {
  export function list() {
    return builtins
  }

  export function builtins() {
    return list()
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }
}
```

- [ ] **Step 6: Export module**

Create `packages/railwise/src/marketplace/index.ts`:

```ts
export * from "./schema"
export * from "./service"
```

- [ ] **Step 7: Verify**

Run:

```bash
cd packages/railwise
bun test test/marketplace/service.test.ts
```

Expected: pass.

- [ ] **Step 8: Commit**

```bash
git add packages/railwise/src/marketplace packages/railwise/test/marketplace/service.test.ts
git commit -m "feat(marketplace): add capability registry"
```

## Task 3: Harness And Marketplace API Routes

**Files:**

- Create: `packages/railwise/src/server/routes/harness.ts`
- Create: `packages/railwise/src/server/routes/marketplace.ts`
- Modify: `packages/railwise/src/server/server.ts`
- Test: `packages/railwise/test/server/harness.test.ts`
- Test: `packages/railwise/test/server/marketplace.test.ts`

- [ ] **Step 1: Write API tests**

Use existing server route test patterns from `packages/railwise/test/server/agent-studio.test.ts`.

Required assertions:

```ts
expect(status.status).toBe(200)
expect(await status.json()).toMatchObject({ mode: "safe" })
expect(capabilities.status).toBe(200)
expect((await capabilities.json()).data.length).toBeGreaterThan(0)
```

- [ ] **Step 2: Implement `GET /harness/status`**

Return a safe default:

```ts
{
  mode: "safe",
  capabilityCount: Marketplace.list().filter((item) => item.enabled).length,
  pendingPermissionCount: 0,
  runningToolCount: 0
}
```

- [ ] **Step 3: Implement `GET /marketplace/capabilities`**

Return:

```ts
{
  data: Marketplace.list()
}
```

- [ ] **Step 4: Register routes**

Modify `packages/railwise/src/server/server.ts` to mount:

```ts
app.route("/harness", harnessRoute)
app.route("/marketplace", marketplaceRoute)
```

- [ ] **Step 5: Verify route tests**

Run:

```bash
cd packages/railwise
bun test test/server/harness.test.ts test/server/marketplace.test.ts --timeout 30000
```

Expected: pass.

- [ ] **Step 6: Regenerate SDK**

Run from repo root:

```bash
./packages/sdk/js/script/build.ts
```

Expected: SDK files update without route schema errors.

- [ ] **Step 7: Commit**

```bash
git add packages/railwise/src/server/routes/harness.ts packages/railwise/src/server/routes/marketplace.ts packages/railwise/src/server/server.ts packages/railwise/test/server/harness.test.ts packages/railwise/test/server/marketplace.test.ts packages/sdk
git commit -m "feat(api): expose harness and marketplace routes"
```

## Task 4: Codex-Style Workbench Page

**Files:**

- Create: `packages/app/src/pages/workbench/index.tsx`
- Create: `packages/app/src/pages/workbench/workbench.css`
- Create: `packages/app/src/pages/workbench/workbench-state.ts`
- Create: `packages/app/src/pages/workbench/workbench-state.test.ts`
- Modify: `packages/app/src/app.tsx`

- [ ] **Step 1: Write state tests**

```ts
import { describe, expect, test } from "bun:test"
import { emptyPrompt, primaryActionLabel, shouldShowZeroCounter } from "./workbench-state"

describe("workbench state", () => {
  test("uses Chinese empty prompts instead of zero counters", () => {
    expect(emptyPrompt({ hasWorkspace: false })).toContain("选择资料目录")
    expect(shouldShowZeroCounter()).toBe(false)
  })

  test("uses chat-first primary actions", () => {
    expect(primaryActionLabel({ hasWorkspace: false })).toBe("选择资料目录")
    expect(primaryActionLabel({ hasWorkspace: true })).toBe("开始会话")
  })
})
```

- [ ] **Step 2: Implement pure state helpers**

```ts
export function shouldShowZeroCounter() {
  return false
}

export function emptyPrompt(input: { hasWorkspace: boolean }) {
  if (!input.hasWorkspace) return "选择资料目录后，RAILWISE 会加载可用智能体、工具和专业流程。"
  return "告诉 RAILWISE 你想完成什么。"
}

export function primaryActionLabel(input: { hasWorkspace: boolean }) {
  if (!input.hasWorkspace) return "选择资料目录"
  return "开始会话"
}
```

- [ ] **Step 3: Create Workbench layout**

The first viewport must have:

- Left rail: Workspaces, recent sessions, Marketplace, Settings.
- Main: one chat composer, three example prompts, recent results.
- Right panel: compact Harness status, model, capabilities, permission state.

The first viewport must not have:

- `智能体 0`
- `工具 0`
- `Skills 0`
- model matrix
- agent matrix

- [ ] **Step 4: Register route**

In `packages/app/src/app.tsx`, add:

```tsx
const Workbench = lazy(() => import("@/pages/workbench/index"))
```

and route:

```tsx
<Route path="/home" component={WorkbenchRoute} />
```

- [ ] **Step 5: Verify**

Run:

```bash
cd packages/app
bun test --preload ./happydom.ts ./src/pages/workbench/workbench-state.test.ts
bun run typecheck
```

Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add packages/app/src/pages/workbench packages/app/src/app.tsx
git commit -m "feat(app): add codex style workbench"
```

## Task 5: Harness Timeline UI

**Files:**

- Create: `packages/app/src/components/harness-status.tsx`
- Create: `packages/app/src/components/harness-timeline.tsx`
- Create: `packages/app/src/components/harness-permission-card.tsx`
- Create: `packages/app/src/components/harness-timeline.test.tsx`

- [ ] **Step 1: Write rendering tests**

Test cases:

- Safe status renders `本地安全模式`.
- Empty timeline renders `开始会话后显示执行过程`.
- Permission event renders approve and reject actions.
- Failed event renders clear failure text.

- [ ] **Step 2: Implement status component**

Component contract:

```tsx
export function HarnessStatus(props: { mode: "safe" | "ask" | "auto"; capabilityCount: number }) {
  return (
    <section class="harness-status">
      <h2>Harness</h2>
      <strong>{props.mode === "safe" ? "本地安全模式" : props.mode === "ask" ? "询问模式" : "自动模式"}</strong>
      <small>{props.capabilityCount > 0 ? `${props.capabilityCount} 项能力已启用` : "选择资料目录后加载能力"}</small>
    </section>
  )
}
```

- [ ] **Step 3: Implement timeline component**

Use event labels from Harness schema. Keep it compact and readable.

- [ ] **Step 4: Verify**

Run:

```bash
cd packages/app
bun test --preload ./happydom.ts ./src/components/harness-timeline.test.tsx
bun run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/components/harness-*.tsx packages/app/src/components/harness-timeline.test.tsx
git commit -m "feat(app): show harness runtime status"
```

## Task 6: Marketplace UI MVP

**Files:**

- Create: `packages/app/src/pages/marketplace/index.tsx`
- Create: `packages/app/src/pages/marketplace/marketplace.css`
- Create: `packages/app/src/pages/marketplace/marketplace-state.ts`
- Create: `packages/app/src/pages/marketplace/marketplace-state.test.ts`
- Modify: `packages/app/src/app.tsx`

- [ ] **Step 1: Write state tests**

```ts
import { describe, expect, test } from "bun:test"
import { categoryLabel, permissionBadges } from "./marketplace-state"

describe("marketplace state", () => {
  test("labels capability categories in Chinese", () => {
    expect(categoryLabel("agent")).toBe("智能体")
    expect(categoryLabel("tool")).toBe("工具")
    expect(categoryLabel("harness_profile")).toBe("Harness 配置")
  })

  test("turns permissions into user-facing badges", () => {
    expect(permissionBadges({ filesystem: "write", network: false, shell: true })).toEqual(["写文件", "执行命令"])
  })
})
```

- [ ] **Step 2: Implement marketplace page**

The page shows:

- Search input.
- Category tabs.
- Capability cards.
- Permission badges.
- Enable/disable buttons.
- Source badge: built-in/local/remote.

- [ ] **Step 3: Register route**

Add `/marketplace` route in `packages/app/src/app.tsx`.

- [ ] **Step 4: Verify**

Run:

```bash
cd packages/app
bun test --preload ./happydom.ts ./src/pages/marketplace/marketplace-state.test.ts
bun run typecheck
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/app/src/pages/marketplace packages/app/src/app.tsx
git commit -m "feat(app): add capability marketplace"
```

## Task 7: Desktop Default Route And Startup Acceptance

**Files:**

- Modify: `packages/desktop/src/index.tsx`
- Modify: `packages/desktop/src-tauri/src/windows.rs`
- Modify: `packages/desktop/e2e/01-startup.spec.ts`

- [ ] **Step 1: Change default route**

Default path must be `/home`, not `/agents` or `/dashboard`.

- [ ] **Step 2: Preserve session routes**

Routes like `/:dir/session` must remain valid because Workbench creates sessions through existing handoff.

- [ ] **Step 3: Update E2E**

Assert:

- URL contains `/home`.
- `data-testid="workbench-page"` is visible.
- Page text contains `告诉 RAILWISE`.
- Page text does not contain `智能体 0`.

- [ ] **Step 4: Verify Desktop**

Run:

```bash
cd packages/desktop
bun run typecheck
bun run build
bun run test:e2e -- 01-startup.spec.ts
```

Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/index.tsx packages/desktop/src-tauri/src/windows.rs packages/desktop/e2e/01-startup.spec.ts
git commit -m "feat(desktop): launch workbench by default"
```

## Task 8: End-To-End Beta QA

**Files:**

- Create: `docs/dev/12-desktop-harness-marketplace-beta.md`
- Modify release notes only if release is triggered.

- [ ] **Step 1: Manual QA script**

Create a doc containing exact QA steps:

```markdown
# Desktop Harness Marketplace Beta QA

1. Launch Desktop.
2. Confirm first screen is Workbench.
3. Confirm there are no large zero counters.
4. Choose a local test directory.
5. Enter: 检查当前目录中的测量资料，列出缺失文件。
6. Confirm a session opens.
7. Confirm Harness panel shows mode and events.
8. Open Marketplace.
9. Confirm built-in capabilities are visible with permissions.
10. Return to Workbench.
```

- [ ] **Step 2: Run package verification**

Run:

```bash
cd packages/railwise
bun test test/harness/schema.test.ts test/marketplace/service.test.ts test/server/harness.test.ts test/server/marketplace.test.ts --timeout 30000

cd ../app
bun test --preload ./happydom.ts ./src/pages/workbench ./src/pages/marketplace ./src/components/harness-timeline.test.tsx
bun run typecheck

cd ../desktop
bun run typecheck
bun run build
```

Expected: all pass.

- [ ] **Step 3: Browser QA**

Use gstack/browser or the in-app browser against the local dev server:

- desktop width: 1440 x 900
- compact width: 390 x 844

Acceptance:

- no overlapping text
- no first-screen zero counters
- composer visible without scrolling
- marketplace cards readable
- Harness panel readable

- [ ] **Step 4: Commit QA docs**

```bash
git add docs/dev/12-desktop-harness-marketplace-beta.md
git commit -m "docs(desktop): add harness marketplace beta qa"
```

## Execution Notes

- Start implementation from a fresh branch based on `dev`, preferably `codex/desktop-harness-marketplace`.
- Do not use the currently dirty working tree for implementation unless the user explicitly asks; it contains many unrelated untracked generated files.
- Run tests from package directories only.
- Use small commits after each task.
- After routes are added, regenerate SDK once and include generated SDK changes in the API commit.
- Do not publish a beta build until Workbench, Harness status, Marketplace MVP, and startup E2E all pass.

## Self-Review

Spec coverage:

- Codex-style UI: covered by Tasks 4 and 7.
- Harness runtime: covered by Tasks 1, 3, and 5.
- Marketplace: covered by Tasks 2, 3, and 6.
- Permission and safety: covered by Harness schema, permission card, and capability permissions.
- Avoid zero-counter UI: covered by Workbench state tests and Desktop E2E.
- Beta verification: covered by Task 8.

Placeholder scan:

- No `TBD`, `TODO`, or open-ended "add validation later" items remain.

Type consistency:

- `CapabilityManifest`, `HarnessStatus`, and `HarnessEvent` names are stable across backend, API, and frontend tasks.

