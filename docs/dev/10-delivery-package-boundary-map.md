# Delivery Package 产品边界图

**日期**: 2026-04-30
**范围**: Core API / App shell UI / Desktop UX / CLI export
**状态**: P2 delivery boundary archived

---

## 1. 结论

Delivery package 必须被拆成三条责任线，而不是被写成一个跨产品的混合功能：

- **Core API**: 生成、验收、归档和持久化交付包契约。
- **Desktop/App UI**: 展示、验收、重新导出和打开本地交付文件。
- **CLI export**: 独立的无头导出命令，面向脚本和 CI。

当前状态：

- Core API 已存在，并写入 `.railwise/workflow-deliveries/<session>/summary.md` 和 `manifest.json`。
- SDK 已生成对应 `agentStudio.workflow.delivery.archive`、`workflow.session`、`workflow.acceptance` 客户端。
- App shell 已有 session composer 内的验收/导出/交付文件展示 UI。
- Desktop 复用 App shell UI，并负责本地文件打开、原生壳验收和 GA 体验。
- CLI 目前只有通用 session JSON export；workflow delivery export 仍是单独 backlog，不能被 Desktop UI 阻塞，也不能依赖 Desktop 路径。

---

## 2. Core API 边界

Core owns:

- `packages/railwise/src/server/routes/agent-studio.ts`
  - `workflowSessionDir()`
  - `workflowDeliveryDir()`
  - `workflowDeliveryPackageDir(sessionId)`
  - `workflowDeliveryPath(sessionId)`
  - `workflowDeliveryManifestPath(sessionId)`
  - `archiveDelivery(input)`
- HTTP API:
  - `GET /agent-studio/workflow/session/:sessionId`
  - `POST /agent-studio/workflow/acceptance`
  - `POST /agent-studio/workflow/delivery/archive`
- Tests:
  - `packages/railwise/test/server/agent-studio.test.ts`
- SDK:
  - `packages/sdk/js/src/v2/gen/sdk.gen.ts`

Core must not own:

- Desktop navigation.
- Native file opening.
- Product copy for business users.
- CLI command UX.

Core acceptance remains API-first:

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000 test/server/agent-studio.test.ts
cd packages/sdk/js && bun run typecheck
```

### 2.1 Delivery manifest contract

The Core archive endpoint owns the on-disk delivery package contract:

- Root manifest kind: `railwise.workflow.delivery`
- Root manifest version: `1`
- Delivery package version: `delivery.version = 1`
- Summary file: `summary.md`
- Manifest file: `manifest.json`
- File list order: summary, copied artifacts, manifest
- Copied artifact names: `artifact-01.*`, `artifact-02.*`, ...

`manifest.json` must include:

- `kind`
- `version`
- `delivery`
- `acceptance`
- `references`

Compatibility rules:

- New optional manifest fields are allowed without blocking CLI or Desktop.
- Removing or renaming required fields blocks both CLI and Desktop until a compatibility reader exists.
- Increment `delivery.version` when package layout or required field semantics change.
- Increment root `version` when manifest-level fields or compatibility rules change.

### 2.2 SDK update rule

Regenerate the JavaScript SDK when a delivery change touches an HTTP request or response schema:

- `WorkflowDeliveryArchive`
- `WorkflowSession`
- `WorkflowAcceptance`
- `/agent-studio/workflow/session/:sessionId`
- `/agent-studio/workflow/acceptance`
- `/agent-studio/workflow/delivery/archive`

Use:

```bash
./packages/sdk/js/script/build.ts
cd packages/sdk/js && bun run typecheck
```

Do not regenerate the SDK for a manifest-only change that is never returned through HTTP. For those changes, update the manifest fixture coverage in `packages/railwise/test/server/agent-studio.test.ts` and document the compatibility decision in this file.

---

## 3. Desktop / App UI 边界

App shell owns the reusable visual controls:

- `packages/app/src/pages/session/composer/session-composer-region.tsx`
- `packages/app/src/pages/agents/api.ts`
- `packages/app/src/types/agent-studio.ts`

Desktop owns the product promise:

- Local file flow.
- Native shell validation.
- Business user delivery review.
- Opening generated summary, manifest and artifact files.
- GA gates around installation, update, crash recovery and real workflow UX.

App shell may call Core APIs through SDK-compatible HTTP calls. It must not claim Desktop release readiness or install/update guarantees.

Desktop/App acceptance:

```bash
cd packages/app && bun run typecheck
cd packages/app && bun run test:unit
cd packages/desktop && bun run typecheck
```

Native Desktop GA still requires:

```bash
cd packages/desktop && bun run test:e2e
cd packages/desktop && bun run check:tauri
cd packages/desktop && bun run test:tauri
```

---

## 4. CLI Export 边界

CLI export is not done just because Desktop/App can display delivery packages.

Current CLI state:

- `packages/railwise/src/cli/cmd/export.ts` exports generic session JSON.
- There is no dedicated workflow delivery export command yet.
- No CLI command depends on `packages/desktop` or Desktop configuration.

CLI backlog remains:

- Design `railwise workflow export` or equivalent.
- Support export by session id.
- Output machine-readable JSON.
- Return non-zero exit codes for missing session, failed acceptance or missing archive.
- Use Core API / Core filesystem contract only.
- Add tests under `packages/railwise/test/cli`.

CLI acceptance:

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000 test/cli
```

---

## 5. Ownership Rule

When a future change touches delivery package behavior, classify it first:

- Contract shape, filesystem layout, archive behavior, SDK type: `core`
- Button, panel, delivery preview, local file affordance: `app` or `desktop`
- Command, JSON output, CI/headless export: `cli`
- Signing, installer, updater, native GA gate: `desktop`

Mixed PRs are allowed only when the dependency is explicit and the PR description lists each product line separately.
