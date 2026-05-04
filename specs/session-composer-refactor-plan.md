# Session Composer Refactor Plan

## Goal

Improve structure, ownership, and reuse for the bottom-of-session composer area without changing user-visible behavior.

Scope:

- `packages/ui/src/components/dock-prompt.tsx`
- `packages/app/src/pages/session/composer/session-todo-dock.tsx`
- `packages/app/src/pages/session/composer/session-question-dock.tsx`
- `packages/app/src/pages/session/composer/session-composer-region.tsx`
- related shared UI in `packages/app/src/components/prompt-input.tsx`

## Progress Snapshot

Status as of 2026-05-04:

- Phase 0 baseline coverage is in place via `packages/app/e2e/session/session-composer-dock.spec.ts`.
- Phase 1 composer colocation is complete under `packages/app/src/pages/session/composer/`.
- Phase 1 blocked state ownership is centralized through `createSessionComposerBlocked()` / `createSessionComposerState()`.
- Phase 2 shared dock surface primitives exist in `packages/ui/src/components/dock-surface.tsx` and `dock-surface.css`.
- `DockPrompt`, `PromptInput`, and `SessionTodoDock` now use the shared shell/tray primitives where appropriate.
- The old global `packages/app/src/components/session-todo-dock.tsx` implementation has been deleted.
- Targeted typecheck and composer/prompt e2e suites were kept green across the incremental PRs. A full local `bun test:e2e:local` remains a release gate, not a per-slice requirement.
- The old-named `session-prompt-dock.test.ts` helper test has been renamed to `session-prompt-helpers.test.ts`.

Remaining follow-ups:

- Decide whether the two remaining inline `Select triggerStyle={{ height: "28px" }}` usages in `PromptInput` justify a shared Select sizing API.
- Consider the optional shared question/permission presentational extraction only if it stays small and remains covered by the composer dock e2e suite.

## Decisions Up Front

1. **`session-prompt-dock` should stay route-scoped.**
   It is session-page orchestration, so it belongs under `pages/session`, not global `src/components`.

2. **The orchestrator should keep blocking ownership.**
   A single component should decide whether to show blockers (`question`/`permission`) or the regular prompt input. This avoids drift and duplicate logic.

3. **Current component does too much.**
   Split state derivation, permission actions, and rendering into smaller units while preserving behavior.

4. **There is style duplication worth addressing.**
   The prompt top shell and lower tray (`prompt-input.tsx`) visually overlap with dock shells/footers and todo containers. We should extract reusable dock surface primitives.

---

## Phase 0 (Mandatory Gate): Baseline E2E Coverage

Status: complete for the merged targeted refactor work. Full local e2e remains a release gate.

The original plan proposed a dedicated guarded backend e2e route. The merged implementation instead uses app e2e helpers that seed dock states through the SDK and poll the real app state. That kept the test surface closer to production behavior while avoiding a test-only backend route.

### 0.1 Deterministic test harness

Add a test-only way to put a session into exact dock states, so tests do not rely on model/tool nondeterminism.

Implemented:

- Seed helpers live in `packages/app/e2e/actions.ts`:
  - `seedSessionQuestion`
  - `seedSessionPermission`
  - `seedSessionTodos`
  - `clearSessionDockSeed`
- The helpers drive the actual SDK/session flows and use polling to wait for seeded dock state.
- `packages/app/script/e2e-local.ts` already provides the e2e runtime environment used by these specs.

### 0.2 New e2e spec

Focused spec:

- `packages/app/e2e/session/session-composer-dock.spec.ts`

Test matrix (minimum required):

1. **Default prompt dock**
   - no blocker state
   - assert prompt input is visible and focusable
   - assert blocker cards are absent

2. **Blocked question flow**
   - seed question request for session
   - assert question dock renders
   - assert prompt input is not shown/active
   - answer and submit
   - assert unblock and prompt input returns

3. **Blocked permission flow**
   - seed permission request with patterns + optional description
   - assert permission dock renders expected actions
   - assert prompt input is not shown/active
   - test each response path (`once`, `always`, `reject`) across tests
   - assert unblock behavior

4. **Todo dock transitions and collapse behavior**
   - seed todos with `pending`/`in_progress`
   - assert todo dock appears above prompt and can collapse/expand
   - update todos to all completed/cancelled
   - assert close animation path and eventual hide

5. **Keyboard focus behavior while blocked**
   - with blocker active, typing from document context must not focus prompt input
   - blocker actions remain keyboard reachable

Notes:

- Prefer stable selectors (`data-component`, `data-slot`, role/name).
- Extend `packages/app/e2e/selectors.ts` as needed.
- Use `expect.poll` for async transitions.

### 0.3 Gate commands (must pass before Phase 1)

Run from `packages/app` (never from repo root):

```bash
bun test:e2e:local -- e2e/session/session-composer-dock.spec.ts
bun test:e2e:local -- e2e/prompt/prompt.spec.ts e2e/prompt/prompt-multiline.spec.ts e2e/commands/input-focus.spec.ts
bun test:e2e:local
```

If any fail, stop and fix before refactor.

---

## Phase 1: Structural Refactor (No Intended Behavior Changes)

Status: complete.

### 1.1 Colocate session-composer files

Created a route-local composer folder:

```txt
packages/app/src/pages/session/composer/
  session-composer-region.tsx      # rename/move from session-prompt-dock.tsx
  session-composer-state.ts        # derived state + actions
  session-permission-dock.tsx      # extracted from inline JSX
  session-question-dock.tsx        # moved from src/components/question-dock.tsx
  session-todo-dock.tsx            # moved from src/components/session-todo-dock.tsx
  index.ts
```

Import updates:

- `packages/app/src/pages/session.tsx` imports `SessionComposerRegion` from `pages/session/composer`.

### 1.2 Split responsibilities

- `session-composer-region.tsx` is focused on rendering orchestration:
  - blocker mode vs normal mode
  - relative stacking (todo above prompt)
  - handoff fallback rendering
- Side-effect/business pieces live in `session-composer-state.ts`:
  - derive `questionRequest`, `permissionRequest`, `blocked`, todo visibility state
  - permission response action + in-flight state
  - todo close/open animation state

### 1.3 Remove duplicate blocked logic in `session.tsx`

`session.tsx` now uses the composer state as the single source for blocker status consumed by both:

- page-level keydown autofocus guard
- composer rendering guard

### 1.4 Keep prompt gating in orchestrator

`session-composer-region` should remain responsible for choosing whether `PromptInput` renders when blocked.

Rationale:

- this is layout-mode orchestration, not prompt implementation detail
- keeps blocker and prompt transitions coordinated in one place

### 1.5 Phase 1 acceptance criteria

- No intentional behavior deltas were introduced by the structural split.
- The targeted Phase 0 suite remained green through the relevant PRs.
- `session-prompt-dock.tsx` no longer exists as a large mixed-responsibility component.
- Session composer files are colocated under `pages/session/composer`.

---

## Phase 2: Reuse + Styling Maintainability

Status: mostly complete. Keep remaining work small and evidence-driven.

### 2.1 Extract shared dock surface primitives

Created reusable shell/tray wrappers to remove repeated visual scaffolding:

- primary elevated surface (prompt top shell / dock body)
- secondary tray surface (prompt bottom bar / dock footer / todo shell)

Proposed targets:

- `packages/ui/src/components` for shared primitives if reused by both app and ui components
- or `packages/app/src/pages/session/composer` first, then promote to ui after proving reuse

Implemented targets:

- `packages/ui/src/components/dock-surface.tsx`
- `packages/ui/src/components/dock-surface.css`

### 2.2 Apply primitives to current components

Adopt in:

- `packages/app/src/components/prompt-input.tsx`
- `packages/app/src/pages/session/composer/session-todo-dock.tsx`
- `packages/ui/src/components/dock-prompt.tsx` (where appropriate)

Focus on deduping patterns seen in:

- prompt elevated shell styles (`prompt-input.tsx` form container)
- prompt lower tray (`prompt-input.tsx` bottom panel)
- dock prompt footer/body and todo dock container

Implemented:

- `DockPrompt` wraps body/footer with `DockShell` / `DockTray`.
- `PromptInput` wraps the top form and bottom bar with `DockShellForm` / `DockTray`.
- `SessionTodoDock` uses `DockTray` and keeps todo-specific rules in `session-todo-dock.css`.
- Prompt model trigger and provider-icon animation hints were moved into `prompt-input.css`; two small Select height overrides remain inline pending a specific Select API decision.

### 2.3 De-risk style ownership

- Dock-specific styling was moved out of broad files where practical.
- Keep slot names stable unless tests are updated in the same PR.

### 2.4 Optional follow-up (if low risk)

Evaluate extracting shared question/permission presentational pieces used by:

- `packages/app/src/pages/session/composer/session-question-dock.tsx`
- `packages/ui/src/components/message-part.tsx`

Only do this if behavior parity is protected by tests and the change is still reviewable.

### 2.5 Phase 2 acceptance criteria

- Duplicated shell/tray styling code has been reduced.
- No regressions were found in the targeted blocker/todo/prompt transition suites run during the incremental PRs.
- Full local e2e remains a release gate.

---

## Implementation Sequence

The original plan assumed a single branch. Execution moved to small PRs to keep review and rollback easier.

Completed:

1. **Step A - Baseline safety net**
   - Add e2e harness + new session composer dock spec + selector/helpers.

2. **Step B - Phase 1 colocation/splitting**
   - Move/rename files, extract state and permission component, keep behavior.

3. **Step C - Phase 1 dedupe blocked source**
   - Remove duplicate blocked derivation and wire page autofocus guard to shared source.

4. **Step D - Phase 2 style primitives**
   - Introduce shared surface primitives and migrate prompt/todo/dock usage.

Deferred:

5. **Step E (optional) - shared question/permission presentational extraction**

Open micro-slices:

1. Decide whether Select needs a size/class API for prompt model triggers.
2. Run the full local e2e suite before GA/release candidate packaging.

---

## Rollback Strategy

- Keep each step logically isolated and easy to revert.
- If regressions occur, revert the latest completed step first and rerun the Phase 0 suite.
- If style extraction destabilizes behavior, keep structural Phase 1 changes and revert only Phase 2 styling commits.
