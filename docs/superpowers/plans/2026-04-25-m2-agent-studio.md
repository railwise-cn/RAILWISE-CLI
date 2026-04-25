# M2 Agent Studio 实施计划

> **For agentic workers:** This plan operationalizes Chapter 4 of `RAILWISE-Desktop-开发实施文档-v1.0.md` (Agent Studio milestone). Detailed code skeletons and acceptance criteria live in that source document — this plan only adds execution order, branch strategy, and verification gates. Track progress via the linked TodoWrite list.

**Goal:** Implement RAILWISE Desktop M2 — visual editing of 13 sub-agents with hot-reload, plus a read-only workflow canvas.

**Architecture (per Chapter 4 of source spec):**
- Backend: 5 new HTTP routes under `/agent-studio/*` (Hono + hono-openapi), one new Bus event `agent.updated`, one FS watcher for `.railwise/agent/*.md`.
- Frontend: 2 new pages (`/agents`, `/agents/:name`) and 7 new components (cards, monaco editor, markdown preview, permission form, workflow canvas, gallery), all in `packages/desktop/src/`. Reuses Solid + 2.0 design tokens (奶白 + 暖棕).
- One Rust command: `git_log_agent` for in-app diff history.

**Tech Stack:** Bun + Hono + Zod (backend), SolidJS + Solid Router + @monaco-editor/loader + marked + chokidar (frontend), Tauri 2 (Rust commands).

**Branch:** `feat/desktop-v1.3.0-m2`, base `feat/desktop-v1.3.0-m1`.

**PR strategy:** Per source spec §M1.7, one PR per 4.x sub-section. We accumulate 6 commits on `feat/desktop-v1.3.0-m2`, then open one umbrella PR (base m1) listing each sub-section in the description so reviewers can navigate per-commit.

---

## Tasks (mapped to source spec sections)

### Task 1 — §4.2 + §4.3 Backend & Bus

- Files:
  - Create: `packages/railwise/src/server/routes/agent-studio.ts` (5 routes — list, get, update, presets, workflow.run)
  - Create: `packages/railwise/src/agent/agent-events.ts` (`AgentUpdated`, `WorkflowCompleted`)
  - Create: `packages/railwise/src/agent/workflow-presets.json` (3 presets per §4.6)
  - Modify: `packages/railwise/src/server/server.ts` — add import + `.route("/agent-studio", AgentStudioRoutes())` before `.route("/mcp", …)` at line 240.
  - Optional: `packages/railwise/src/agent/agent-watcher.ts` (chokidar FS watcher) per §4.3
- Verify: `bun turbo typecheck` passes; `curl http://localhost:<port>/agent-studio/list` returns array; `curl PUT` writes file and broadcasts `agent.updated` to `/event` SSE.
- Commit: `feat(agent-studio): add HTTP routes + bus events + workflow presets`

### Task 2 — §4.4 Card wall page

- Files:
  - Create: `packages/desktop/src/pages/agents/index.tsx` (route `/agents`)
  - Create: `packages/desktop/src/components/agent-card.tsx` (4px brand color rail + Chinese mode badge + last-7-day call count)
  - Create: `packages/desktop/src/hooks/use-agent-updates.ts` (SSE subscriber for `agent.updated`)
- Verify: typecheck; manual: page renders 13 agents, refresh on PUT triggers SSE.
- Commit: `feat(agent-studio): card wall page + SSE hot-reload hook`

### Task 3 — §4.5 Detail editor page (3-pane)

- Files:
  - Create: `packages/desktop/src/pages/agents/[name].tsx`
  - Create: `packages/desktop/src/components/agent-editor.tsx` (Monaco)
  - Create: `packages/desktop/src/components/agent-preview.tsx` (marked)
  - Create: `packages/desktop/src/components/agent-permission-form.tsx`
- Verify: typecheck; save → Bus → SSE → card refresh round-trip.
- Commit: `feat(agent-studio): three-pane detail editor (monaco + preview + permission)`

### Task 4 — §4.6 Workflow canvas (read-only v1)

- Files:
  - Create: `packages/desktop/src/types/workflow.ts`
  - Create: `packages/desktop/src/components/workflow-canvas.tsx` (SVG)
  - Create: `packages/desktop/src/components/workflow-gallery.tsx`
- Verify: typecheck; canvas renders 3 presets with serial + parallel branches.
- Commit: `feat(agent-studio): SVG workflow canvas + preset gallery`

### Task 5 — §4.7 Tests + Rust git_log_agent

- Files:
  - Create: `packages/app/src/__tests__/agent-card.test.ts` (5 tests)
  - Create: `packages/app/src/__tests__/workflow-canvas.test.ts` (4 tests)
  - Modify: `packages/desktop/src-tauri/src/lib.rs` — append `git_log_agent` & `git_diff_agent` commands
- Verify: `cd packages/app && bun test`; `cd packages/railwise && bun test`; `bun turbo typecheck` zero error; `bun run --cwd packages/desktop build` succeeds.
- Commit: `test(agent-studio): unit tests + git history Tauri commands`

### Task 6 — Final verification + PR

- Verify all 7 acceptance items from source §4.1.3 (manual checklist; document evidence inline in the PR description).
- Push branch, open PR (`gh pr create --base feat/desktop-v1.3.0-m1`).
- Mark M2 complete.

---

## Risks & assumptions

- `Agent.list()` returns hidden system agents; we filter `!a.hidden` in `/agent-studio/list` per spec.
- Hono matches routes in declaration order — static `/list`, `/workflow/presets`, `/workflow/run` MUST be declared before `/:name` (spec §4.2.3 callout).
- Monaco editor adds ~600KB to bundle; acceptable per M1 perf budget (3s TTFUI) since it lazy-loads on `/agents/:name` only.
- `chokidar` is already a dep of `packages/railwise` (or we'll add it). FS watcher must be initialized lazily once per server lifetime to avoid duplicate `agent.updated` events.
- All Specta bindings auto-regenerate via `bun run --cwd packages/desktop scripts/predev.ts` when Rust commands change; no manual edit to `bindings.ts`.
