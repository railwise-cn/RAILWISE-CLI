---
name: RAILWISE CLI Business OS
description: Define RAILWISE CLI/Core as the business engine for surveying multi-agent workflows, on-demand skills, office/CAD IO, and engineering deliverables
type: product-architecture-spec
---

# RAILWISE CLI Business OS Design

**Date**: 2026-05-27  
**Target**: `packages/railwise`, `.railwise`, `packages/nb-railwise`  
**Repository**: RAILWISE-CLI monorepo  
**Branch**: `feat/desktop-v1.3.0-m2`  

## Overview

RAILWISE should be a surveying and monitoring business operating system first, and a Desktop app second. The CLI/Core package owns the real product: agents, skills, tools, workflows, memory, office/CAD input, and engineering deliverable output. Web and Desktop clients should consume this core instead of carrying business logic.

The product goal is to make RAILWISE genuinely represent Ningbo Ruiwei's main work: engineering surveying, structural monitoring, metro protection-zone monitoring, CPIII/control-network deliverables, bidding documents, standards knowledge, and office-ready internal production. The user should be able to give RAILWISE a project folder, scattered source files, or a business instruction, and get an auditable multi-agent workflow with Word/Excel/PPT/PDF artifacts and QA review.

RAILWISE also needs an automatic upstream update posture. The project is based on opencode and has useful inspiration from oh-my-opencode. CLI/Core should be able to detect upstream opencode and oh-my-opencode versions, summarize local divergence, and propose safe sync actions without mixing business code with Desktop release work.

## Design Principles

1. **CLI/Core is the business engine**  
   `packages/railwise` owns all domain behavior. Desktop and Web remain shells for launch, preview, review, and configuration.

2. **RAILWISE is a business method, not only a brand string**  
   The brand means a repeatable Ruiwei-style process: source intake, first inspection, calculation, trend analysis, standards citation, writing, QA review, and artifact delivery.

3. **All business lines are in scope, but implemented as reusable pipelines**  
   The system must cover monitoring reports, CPIII/control networks, bids, standards ingestion, and office/CAD IO. Shared runtime pieces come first.

4. **Context is loaded on demand**  
   Inspired by Pi's compact prompt discipline, the always-on system prompt should stay small. Agent prompts should define role and routing rules. Skill bodies should load only when a task triggers them.

5. **Evidence beats memory**  
   Numerical results must come from tools. Standards references must come from a queryable standards source. Generated reports must retain source file, tool result, and QA trace metadata.

6. **Artifacts are first-class**  
   Workflows produce tracked artifacts: Markdown drafts, DOCX, XLSX, PPTX, charts, extracted drawing summaries, review comments, and final packages.

7. **Inputs are analyzed before work begins**
   The system should help the user decide what input is required. A workflow starts with input analysis, missing-file detection, and a source manifest rather than assuming the current folder has enough material.

8. **Outputs always land in one fixed project directory**
   All generated artifacts must go under a stable project-local `output/` tree unless an explicit export destination is requested. Tools should not default to writing beside arbitrary source files.

9. **Upstream sync is a managed workflow**
   opencode and oh-my-opencode updates should be checked automatically, summarized, and applied through explicit sync tasks with changelog, conflict, and regression gates.

## Current State

### Strengths

- `.railwise/agent/chief_manager.md` already defines a real business dispatch model with mandatory QA gates and subagent routing.
- `.railwise/tool` contains the main surveying tools, including monitoring CSV, survey calculators, CPIII adjustment, standards query, Excel export, chart generation, and Word export.
- `ToolRegistry` already scans `.railwise/tool` and `.railwise/tools`, so local tool auto-loading is structurally present.
- `SkillTool` already advertises skill metadata and loads full `SKILL.md` content only when the model calls the skill tool.
- `report_export` can create a valid DOCX archive from Markdown, and `excel_export` has a working monitoring-table path.
- `workflow-presets.json` contains the right business scenarios and node/edge model.

### Gaps

- Workflow presets currently seed a session prompt; they are not yet an executable workflow runtime with node states, retries, artifacts, and resumability.
- Skill content can still enter context through slash-command registration because `Command` maps skills to full-content command templates.
- Tool registry behavior needs hardening: duplicate business tool IDs can appear, and tools with external dependencies are not reliably loaded in tests.
- `report_export` is valid but too minimal for engineering delivery. It lacks template styles, tables, images/charts, headers/footers, cover pages, approval blocks, and PDF export.
- Office and CAD input is incomplete. The core needs DOCX/XLSX/PPTX/PDF/image/DXF reading and a DWG strategy.
- Output paths are not yet centralized. Some tools still default to `./<title>.*`, which can scatter generated files.
- Knowledge is split across skills, memory, standards tools, and project files. There is not yet a persistent, Markdown-native engineering wiki with source lineage.
- Upstream version drift is manual. The repo knows about `upstream` opencode, but does not yet model opencode and oh-my-opencode sync as a first-class maintenance workflow.
- Desktop-specific routes and Agent Studio naming blur the boundary between shell and core.

## Architecture

### 1. Core Packages

**`packages/railwise`**

Owns:
- Agent loading and permissions.
- Workflow runtime and business presets.
- Tool registry and execution.
- Skill metadata, discovery, and on-demand loading.
- Project memory, standards knowledge, and the RAILWISE Wiki.
- Office/CAD ingestion and artifact export.
- Fixed project output directory management.
- Upstream version detection and sync planning.
- CLI commands and local HTTP API.

**`packages/nb-railwise`**

Owns:
- Tool SDK contract.
- Typed tool definitions.
- Tool context helpers for paths, artifacts, permissions, and metadata.
- Test helpers for custom tools.

**`.railwise`**

Ships the default RAILWISE business kit:
- Agents.
- Skills.
- Business commands.
- Workflow templates.
- Surveying tools.
- Report templates.
- Wiki schema and default knowledge page templates.

**`packages/app` / `packages/desktop`**

Consume Core APIs only:
- Open a workspace.
- Start a workflow.
- Show status, events, artifacts, and QA comments.
- Preview office/CAD outputs.
- Manage settings and credentials.

### 2. Workflow Runtime

Introduce a Core workflow service independent of Desktop UI:

```text
workflow preset
  -> validated workflow run
  -> node scheduler
  -> task tool / direct agent call
  -> tool execution and artifact writes
  -> QA gate
  -> final delivery package
```

Each workflow run stores:
- `run_id`, `workflow_id`, `project_id`, status, timestamps.
- Input manifest with required, found, missing, ignored, and unsupported files.
- Node instances with agent, prompt, dependencies, status, attempts, and result summary.
- Artifact records with path, type, source node, checksum, and review state.
- QA gate records with reviewer, verdict, blocking issues, and revision count.

Node execution rules:
- Every run starts with input analysis unless the workflow explicitly marks itself as source-free.
- `parallel` edges allow independent nodes to start together.
- `serial` edges require upstream success.
- `optional` edges can fail without failing the whole run if explicitly marked.
- QA rejection sends work back to the responsible node, with a maximum of two revision loops before user decision.

### 3. Fixed Project Output Tree

All tools and workflows should write generated artifacts under a fixed project-local directory:

```text
output/
  runs/<run_id>/
    manifest.json
    logs/
    drafts/
    reports/
    tables/
    charts/
    drawings/
    packages/
  wiki/
  latest -> runs/<run_id>
```

Rules:
- `output/runs/<run_id>` is immutable after a workflow is finalized, except for explicit review metadata.
- `output/latest` points to the most recent run for user convenience.
- `output/wiki` stores the durable knowledge base, not transient run files.
- Tools receive an artifact writer from `nb-railwise` and default into the active run directory.
- Explicit `outputPath` remains supported, but the result is still recorded in the artifact registry.
- Source files are never overwritten or moved.

### 4. Input Analysis

The user should not have to know every required input upfront. RAILWISE should analyze the task and ask for only the missing material.

Input analysis produces:
- Workflow type guess: monitoring report, CPIII/control network, bid, standards ingest, office/CAD extraction, or unknown.
- Required input checklist.
- Found file list with type, role, confidence, and parseability.
- Missing or ambiguous items with impact and suggested source.
- Unsupported format list with conversion path.
- Recommended output package.

Examples:
- Monitoring report requires project name, period, monitoring table, control values, and report template.
- CPIII package requires route section, known point results, observation files, coordinate system, and acceptance standard.
- Bid proposal requires tender file, owner requirements, scope, qualification material, and pricing assumptions.
- Standards wiki ingest requires raw source, source metadata, citation policy, and target wiki category.

The first interactive question in a workflow should come from this analysis, not from a generic agent guess.

### 5. Business Pipelines

#### Metro / Deep Foundation Monitoring

Purpose: daily, weekly, and monthly monitoring deliverables.

Flow:
1. `source_ingestor` inventories source files and templates.
2. `qa_inspector` checks raw field data and missing fields.
3. `data_analyst` runs monitoring, trend, and alert tools.
4. `norm_librarian` cites relevant standards and owner requirements.
5. `technical_writer` drafts the report.
6. `qa_reviewer` performs blocking review.
7. Export DOCX/XLSX/PDF package.

#### CPIII / Control Network Deliverables

Purpose: CPIII retest, free-station resection, control-network adjustment, and results package.

Flow:
1. `source_ingestor` checks point results, observation files, baseline data, and route section.
2. `cpiii_specialist` defines field and acceptance constraints.
3. `adjustment_computer` runs CPIII/control-network tools.
4. `norm_librarian` locks standards references.
5. `technical_writer` drafts results.
6. `qa_reviewer` blocks noncompliant results.

#### Bid Proposal

Purpose: technical proposal, commercial response, qualification matrix, and submission draft.

Flow:
1. `source_ingestor` extracts bid requirements.
2. `solution_architect` drafts the monitoring/surveying technical plan.
3. `commercial_specialist` drafts commercial response and pricing assumptions.
4. `technical_writer` assembles the bid document.
5. `qa_reviewer` checks mandatory response and technical compliance.

#### Standards / Owner Requirement Knowledge Base

Purpose: turn standards, owner templates, historical reports, and meeting notes into reusable project knowledge.

Flow:
1. `source_ingestor` extracts source structure.
2. `norm_librarian` creates standards pages and citation records.
3. `knowledge_curator` creates case summaries and FAQ.
4. `qa_reviewer` checks source traceability.

This pipeline writes into `output/wiki`, not only memory tables.

#### Office / Drawing Intake And Output

Purpose: make common office documents and engineering drawings readable and writable.

Inputs:
- DOCX: paragraphs, headings, tables, comments, embedded images.
- XLSX/CSV: sheets, headers, data ranges, merged cells, formulas as text.
- PPTX: slide titles, text boxes, tables, charts as extracted summaries.
- PDF/image: OCR or external parser integration, with source-page citations.
- DXF: layers, blocks, polylines, text, dimensions, coordinates.
- DWG: use a conversion bridge first, then feed DXF-like extraction. Native DWG can be a later enterprise integration.

Outputs:
- DOCX: report, bid document, review memo, technical scheme.
- XLSX: monitoring tables, statistics, warning lists, calculation summaries.
- PPTX: owner briefing, monthly summary, risk explanation.
- PDF: final generated package or exported office document.
- Markdown: intermediate draft and auditable source.

### 6. RAILWISE Wiki Knowledge Base

RAILWISE should adopt a Karpathy-style LLM Wiki pattern for engineering knowledge. The core idea is not classic RAG where raw chunks are rediscovered on every question. Instead, the agent compiles raw sources into a persistent, interlinked Markdown wiki that becomes richer with every source and useful question.

Directory model:

```text
output/wiki/
  raw/
    standards/
    owner-requirements/
    project-docs/
    reports/
    meeting-notes/
    drawings/
  wiki/
    index.md
    log.md
    standards/
    projects/
    entities/
    concepts/
    workflows/
    faq/
  schema/
    AGENTS.md
    citation-policy.md
    page-template.md
```

Layer rules:
- `raw/` is immutable source material. Agents read it but never edit it.
- `wiki/` is the LLM-maintained synthesis layer: summaries, entity pages, standards pages, project pages, comparisons, contradictions, and workflow notes.
- `schema/` is the operating contract for the wiki: page format, citation rules, ingest workflow, lint workflow, naming, and review policy.
- `index.md` is the navigable catalogue.
- `log.md` records every ingest, query-to-page conversion, lint, and QA correction.

Operations:
- `wiki ingest <path>` reads one source or a curated batch, creates or updates relevant pages, records citations, and appends a log entry.
- `wiki query <question>` answers from `index.md` and linked pages first, then raw sources if needed.
- `wiki file-answer` turns valuable answers into durable wiki pages so discoveries do not vanish into chat history.
- `wiki lint` checks stale claims, missing citations, broken links, duplicate pages, and contradictions.
- `wiki export` can produce a standards appendix or project knowledge handover.

Business use:
- Store GB/JGJ/owner requirement summaries with citation trail.
- Store Ruiwei project-specific preferences, report templates, accepted phrasing, and owner review comments.
- Store reusable explanations for warning levels, CPIII processes, and monitoring methods.
- Feed `norm_librarian`, `knowledge_curator`, `technical_writer`, and `qa_reviewer` without injecting the full knowledge base into the system prompt.

The wiki complements SQLite memory. SQLite memory is for small session facts and retrieval metadata; the wiki is for human-readable, versionable engineering knowledge.

### 7. Upstream Version Sync

RAILWISE should track upstream implementation sources without letting them dominate the business architecture.

Sources:
- `upstream`: `sst/opencode`.
- `oh-my-opencode`: configured as a named source, either a git remote, package source, or pinned GitHub repository URL.

Version state:
- Current RAILWISE package version.
- Last synced opencode commit/tag.
- Last scanned opencode commit/tag.
- Last synced oh-my-opencode commit/tag/version.
- Local patch count and conflict-risk summary.
- Generated SDK/API compatibility status.

Commands:
- `railwise upstream status`: show opencode and oh-my-opencode latest known versions, local pinned versions, divergence, and recommended action.
- `railwise upstream check`: fetch metadata and write a sync report under `output/upstream/`.
- `railwise upstream plan`: produce a human-readable migration plan with changed areas, risk, and tests.
- `railwise upstream apply`: future guarded command for applying an approved sync plan.

Automation:
- A scheduled or manual check can compare remotes/tags and create a report.
- The first phase should be report-only; code application should remain manual until tests and conflict gates are reliable.
- Sync reports become wiki sources so lessons learned compound in `output/wiki/wiki/workflows/upstream-sync.md`.

Safety gates:
- Never merge upstream directly into a dirty worktree.
- Never let upstream sync modify `.railwise` business agents, tools, or report templates without explicit review.
- Always run package-level typecheck and targeted tests from package directories.
- Regenerate SDK output only through the documented build script when API changes require it.

## Context And Skill Loading

The always-on prompt should stay small:
- Product identity.
- Current agent role.
- Tool-use safety rules.
- Workflow status summary.
- Available skill metadata only.

Full skill content should load only through `skill` tool invocation or an explicit workflow node requirement.

Changes:
- Keep `SkillTool` metadata listing.
- Stop registering full skills as slash-command templates.
- Replace skill slash commands with a compact wrapper: "Load skill `<name>` and apply it to `$ARGUMENTS`."
- Add trigger metadata to skills over time, so the model can select skills by business intent without full content injection.
- Add tests that assert skill command templates do not include full `SKILL.md` bodies.

Target:
- System prompt plus agent prompt should remain compact enough for fast first-token latency.
- Long business knowledge lives behind tools, skills, memory retrieval, and source artifacts.

## Tool SDK And Registry Design

`nb-railwise` remains the tool SDK. It needs hardening rather than a replacement.

Required capabilities:
- Load all `.railwise/tool/*.ts` and `.railwise/tools/*.ts`.
- Deduplicate IDs deterministically, with project tools overriding global tools.
- Support default export and named exports.
- Support external dependencies from `.railwise/package.json`.
- Surface failed tool loads as diagnostics without dropping the rest of the registry.
- Provide SDK helpers for artifact writing, stable path resolution, and the active `output/runs/<run_id>` directory.

First hardening targets:
- Fix the external dependency loading path tested by `registry.test.ts`.
- Remove duplicate business tool IDs.
- Add a single inventory test for the required RAILWISE business tools.
- Add CLI diagnostics: `railwise debug tools` should show loaded, skipped, duplicate, and failed tools.

## Report And Office Export Design

`report_export` should evolve from valid DOCX generation to engineering report assembly.

Required DOCX capabilities:
- Template profile: monitoring report, CPIII results, bid proposal, review memo.
- Cover page and project metadata.
- Heading hierarchy and numbering.
- Tables from structured data.
- Embedded SVG/PNG charts.
- Header/footer, page numbers, company name, and approval block.
- Appendix section with source artifacts.
- Optional PDF export through a local converter when available.

Required XLSX capabilities:
- Existing monitoring table export.
- Multi-sheet report package.
- Warning list, top-change points, QA issue table, and calculation summary.

Required PPTX capabilities:
- Project briefing deck from structured sections.
- Chart image placement.
- Owner-facing summary style.

All exporters must default to the fixed output tree and return artifact registry metadata, not only a file path string.

## Data Flow

```text
User input / files
  -> input analysis
  -> source_ingestor
  -> source manifest + missing list
  -> output/runs/<run_id>/manifest.json
  -> workflow runtime
  -> subagent tasks and deterministic tools
  -> artifacts
  -> output/wiki updates when knowledge should persist
  -> qa_reviewer gate
  -> final package
  -> CLI/Web/Desktop preview
```

Artifacts must be written under the fixed project-local `output/` tree unless the user provides an explicit export destination. Each artifact record should include source node and dependency metadata so QA can trace how a final number or paragraph was produced.

## Error Handling

- Missing required files: workflow pauses and asks for missing files instead of hallucinating.
- Ambiguous input role: source ingestor marks candidate roles and asks the user to confirm instead of guessing.
- Unsupported document format: source ingestor explains accepted conversion paths.
- Tool parse failure: record failed artifact, include offending row/file/page, and route to QA or user.
- Calculation precondition failure: `adjustment_computer` returns a structured missing-input list.
- Standards uncertainty: `norm_librarian` marks "需规范库复核" instead of inventing article numbers.
- QA rejection: route back to the producing node with exact issues; stop after two failed revisions.
- Export failure: preserve Markdown/XLSX intermediate artifacts and report the failed conversion step.
- Wiki ingest conflict: record both claims, mark contradiction, and require `qa_reviewer` or user resolution before promoting the page.
- Upstream sync conflict: write a report under `output/upstream/` and stop before code changes.

## Testing And Verification

Tests must run from package directories, not repo root.

Core tests:
- `packages/railwise`: workflow scheduler, node dependency handling, QA rejection loops, artifact records.
- `packages/railwise`: fixed `output/` tree creation and artifact path policy.
- `packages/railwise`: input analyzer classifies required/found/missing files for each business workflow.
- `packages/railwise`: skill command wrapper does not inject full skill content.
- `packages/railwise`: tool registry loads all required RAILWISE tools, deduplicates IDs, and reports failed external dependency tools.
- `packages/railwise`: `report_export` produces valid DOCX archives and expected XML parts.
- `packages/railwise`: `excel_export` produces valid XLSX archives for monitoring tables.
- `packages/railwise`: wiki ingest/query/lint operate on `output/wiki` without mutating raw sources.
- `packages/railwise`: upstream status/check produce report-only sync artifacts for opencode and oh-my-opencode.

Business golden tests:
- Monitoring monthly report fixture.
- CPIII control-network fixture.
- Bid proposal fixture.
- Standards ingestion fixture.
- Office/CAD extraction fixture.

Manual acceptance:
- Run a monitoring report workflow from CLI.
- Confirm produced DOCX/XLSX can open in Office/WPS.
- Confirm all outputs land under `output/runs/<run_id>` and `output/latest`.
- Confirm wiki ingest creates `index.md`, `log.md`, and cited pages under `output/wiki`.
- Confirm `railwise upstream status` shows opencode and oh-my-opencode version state.
- Confirm QA reviewer can reject and trigger a revision.
- Confirm Desktop/Web can display workflow state without owning workflow logic.

## Implementation Phases

### Phase 1: Core Hardening

Scope:
- Context slimming.
- Skill command wrapper.
- Fixed `output/` tree and artifact writer baseline.
- Tool registry dedupe and diagnostics.
- External dependency tool loading fix.
- Required RAILWISE tool inventory test.
- `report_export` DOCX smoke verification and template roadmap test.
- Report-only upstream status/check for opencode and oh-my-opencode.

Success:
- Full business tool inventory loads once.
- Skills are available without full-content slash command injection.
- Generated files use the fixed output directory by default.
- `report_export` and `excel_export` have repeatable package-level verification.
- Upstream status produces a safe report without applying code changes.

### Phase 2: Workflow Runtime

Scope:
- Core workflow run model.
- Input analysis and source manifest.
- Node scheduler with serial/parallel dependencies.
- Artifact records.
- QA gate and retry loop.
- CLI command `railwise workflow list/run/status`.

Success:
- Monitoring and CPIII workflows run from CLI without Desktop.

### Phase 3: Office And Drawing IO

Scope:
- DOCX/XLSX/PPTX/PDF extraction.
- DXF extraction.
- DWG conversion strategy.
- Structured source manifest.
- Workflow-aware input analysis for required office/CAD materials.

Success:
- Source ingestor can summarize common office documents and engineering drawings into auditable inputs.

### Phase 4: RAILWISE Wiki

Scope:
- `output/wiki` raw/wiki/schema directory model.
- Wiki ingest/query/file-answer/lint commands.
- Standards and owner-requirement page templates.
- Source lineage, citations, contradiction markers, and log.

Success:
- RAILWISE can maintain a Markdown-native engineering knowledge wiki that agents query instead of reinjecting all source knowledge.

### Phase 5: Engineering Deliverables

Scope:
- DOCX templates.
- XLSX report package.
- PPTX briefing output.
- Optional PDF export.

Success:
- RAILWISE can produce office-ready artifacts for the major business lines.

### Phase 6: Upstream Sync Automation

Scope:
- opencode version tracking.
- oh-my-opencode version tracking.
- Sync reports under `output/upstream/`.
- Wiki-backed sync lessons.
- Guarded sync plan generation.

Success:
- RAILWISE can detect upstream drift, summarize changes, and produce safe implementation plans without touching business assets automatically.

### Phase 7: Thin Client Alignment

Scope:
- Web/Desktop consume workflow APIs.
- Remove business duplication from shell UI.
- Keep Desktop as local installer, file preview, and workflow monitor.

Success:
- CLI/Core remains the product authority.
- Desktop is useful without becoming the architecture center.

## First Implementation Slice

The first implementation plan should focus on:

1. Context slimming and on-demand skill loading.
2. Fixed `output/` directory and artifact writer baseline.
3. Tool SDK and registry hardening.
4. `report_export` engineering baseline.
5. Report-only upstream version status for opencode and oh-my-opencode.

This slice is small enough to land safely and unlocks the rest of the business workflow work.

## Acceptance Criteria

- RAILWISE's core business logic is documented as CLI/Core owned.
- Desktop is explicitly out of scope for business logic implementation.
- All five business lines are represented.
- Office and CAD input/output requirements are defined.
- Fixed `output/` directory policy is defined.
- Input analysis is defined as the first workflow step.
- RAILWISE Wiki knowledge-base behavior is defined with raw/wiki/schema layers.
- Upstream opencode and oh-my-opencode version tracking is defined as a safe report-first workflow.
- Pi-inspired prompt slimming is captured as an architecture requirement.
- The next implementation slice is specific and testable.

## References

- Andrej Karpathy, "LLM Wiki" gist, created 2026-04-04: https://gist.github.com/karpathy/442a6bf555914893e9891c11519de94f
- LLM Wiki pattern summary: https://llmwiki.lol/
