# Codex-Style Desktop Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework `/agents` into a Codex-style minimal engineering AI workbench while preserving all Harness, agent, model, Marketplace, tool, and Skill capabilities.

**Architecture:** Keep the existing data loading and session handoff logic in `packages/app/src/pages/agents/index.tsx`, but reorganize the rendered surface into a primary task composer, compact project rail, and collapsible secondary capability area. Keep Marketplace and routing APIs unchanged.

**Tech Stack:** SolidJS, existing RAILWISE app components, `agent-studio.css`, Bun tests.

---

### Task 1: Lock Product Spec

**Files:**
- Create: `docs/superpowers/specs/2026-05-24-codex-style-desktop-redesign.md`
- Create: `docs/superpowers/plans/2026-05-24-codex-style-desktop-redesign.md`

- [ ] **Step 1: Write the design spec**

Create the spec with goal, product principle, information architecture, first slice scope, and acceptance criteria.

- [ ] **Step 2: Write this implementation plan**

Create this plan with exact target files and verification commands.

- [ ] **Step 3: Verify no placeholders**

Run:

```bash
bun -e 'const fs=require("fs"); const files=["docs/superpowers/specs/2026-05-24-codex-style-desktop-redesign.md","docs/superpowers/plans/2026-05-24-codex-style-desktop-redesign.md"]; const words=[["T","BD"].join(""),["TO","DO"].join(""),["implement","later"].join(" "),["fill","in"].join(" ")]; for (const file of files) for (const [index,line] of fs.readFileSync(file,"utf8").split("\n").entries()) if (words.some((word)=>line.includes(word))) console.log(`${file}:${index+1}:${line}`)'
```

Expected: no matches.

### Task 2: Simplify Agents Home Structure

**Files:**
- Modify: `packages/app/src/pages/agents/index.tsx`
- Modify: `packages/app/src/pages/agents/agent-studio.css`

- [ ] **Step 1: Add UI state for advanced surfaces**

Add:

```ts
const [advancedOpen, setAdvancedOpen] = createSignal(false)
const [marketOpen, setMarketOpen] = createSignal(false)
```

- [ ] **Step 2: Reorganize the page shell**

Keep `main.agent-studio.railwise-codex`, but make the layout:

- `rw-sidebar`: project context, recent workspaces, compact status, market/settings buttons.
- `rw-main`: hero line, central task composer, recommended prompts.
- `rw-inspector`: current execution summary.
- `rw-secondary`: collapsible professional agents and Marketplace.

- [ ] **Step 3: Preserve existing action contracts**

Keep these test and integration hooks:

```tsx
data-testid="agents-page"
data-testid="agent-project-directory"
data-testid="agent-collaboration-start"
data-testid="agent-collaboration-agent"
data-testid="agent-collaboration-prompt"
data-testid="agent-start-session"
data-testid="agent-harness-plan"
data-testid={`market-filter-${item.value}`}
data-testid={`market-capability-${capability.id}`}
data-testid={`market-capability-toggle-${capability.id}`}
```

- [ ] **Step 4: Reduce visible copy**

Replace explanatory paragraphs with short labels:

- `把工程任务交给 RAILWISE`
- `项目`
- `执行`
- `能力`
- `模型`
- `权限`

Keep detailed descriptions inside expanded secondary panels only.

### Task 3: Make Capabilities Progressive

**Files:**
- Modify: `packages/app/src/pages/agents/index.tsx`
- Modify: `packages/app/src/pages/agents/agent-studio.css`

- [ ] **Step 1: Move professional agents behind an expand button**

Render the agent row only when `advancedOpen()` is true. The selected agent dropdown stays in the composer.

- [ ] **Step 2: Move Marketplace behind an expand button**

Render the search, filters, and capability cards only when `marketOpen()` is true. Show a compact status line before expansion.

- [ ] **Step 3: Keep tools and Skills behind advanced disclosure**

Do not show tool/Skill lists on the first viewport. Reveal the top tool/Skill rows when `advancedOpen()` is true, and keep full Marketplace control in the expanded market section.

### Task 4: Update Styling for Codex-Like Focus

**Files:**
- Modify: `packages/app/src/pages/agents/agent-studio.css`

- [ ] **Step 1: Convert layout to app-shell**

Use a fixed sidebar, central max-width content, and right inspector on desktop. On small screens stack panels.

- [ ] **Step 2: Make composer dominant**

Increase the textarea and submit row prominence. Keep panel radius at 8px or less.

- [ ] **Step 3: Remove dashboard feel**

Avoid large stat grids on the first viewport. Use compact rows and chips.

### Task 5: Add Focused Tests

**Files:**
- Modify or create: `packages/app/src/pages/agents/collaboration.test.ts`

- [ ] **Step 1: Add helper test for compact capability counts**

If a new helper is introduced, test it in `collaboration.test.ts`. If no helper is introduced, keep existing tests and rely on typecheck plus browser verification.

- [ ] **Step 2: Run app tests**

Run:

```bash
bun test --preload ./happydom.ts packages/app/src/pages/agents/collaboration.test.ts packages/app/src/pages/agents/capabilities.test.ts
```

Expected: all tests pass.

### Task 6: Verify Desktop Surface

**Files:**
- No source edits unless verification finds a bug.

- [ ] **Step 1: Typecheck app**

Run from `packages/app`:

```bash
bun run typecheck
```

Expected: pass.

- [ ] **Step 2: Build desktop frontend**

Run from `packages/desktop`:

```bash
bun run build
```

Expected: pass.

- [ ] **Step 3: Capture local preview if a server is available**

If dev server is running, open `/agents` and confirm first viewport shows project, task input, and execution summary before Marketplace cards.

### Task 7: Commit the Slice

**Files:**
- Stage only files touched by this redesign.
- Do not stage unrelated existing changes in `packages/desktop/src-tauri/src/cad.rs` or `packages/desktop/src-tauri/src/cli.rs`.

- [ ] **Step 1: Review diff**

Run:

```bash
git diff --stat
git diff -- packages/app/src/pages/agents/index.tsx packages/app/src/pages/agents/agent-studio.css docs/superpowers/specs/2026-05-24-codex-style-desktop-redesign.md docs/superpowers/plans/2026-05-24-codex-style-desktop-redesign.md
```

- [ ] **Step 2: Commit**

Use semantic commit style:

```bash
git add packages/app/src/pages/agents/index.tsx packages/app/src/pages/agents/agent-studio.css docs/superpowers/specs/2026-05-24-codex-style-desktop-redesign.md docs/superpowers/plans/2026-05-24-codex-style-desktop-redesign.md
git commit -m "feat(app): simplify desktop agent workbench"
```
