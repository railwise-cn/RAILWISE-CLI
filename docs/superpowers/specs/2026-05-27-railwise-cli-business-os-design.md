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
- Desktop-specific routes and Agent Studio naming blur the boundary between shell and core.

## Architecture

### 1. Core Packages

**`packages/railwise`**

Owns:
- Agent loading and permissions.
- Workflow runtime and business presets.
- Tool registry and execution.
- Skill metadata, discovery, and on-demand loading.
- Project memory and standards knowledge.
- Office/CAD ingestion and artifact export.
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
- Node instances with agent, prompt, dependencies, status, attempts, and result summary.
- Artifact records with path, type, source node, checksum, and review state.
- QA gate records with reviewer, verdict, blocking issues, and revision count.

Node execution rules:
- `parallel` edges allow independent nodes to start together.
- `serial` edges require upstream success.
- `optional` edges can fail without failing the whole run if explicitly marked.
- QA rejection sends work back to the responsible node, with a maximum of two revision loops before user decision.

### 3. Business Pipelines

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
- Provide SDK helpers for artifact writing and stable path resolution.

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

## Data Flow

```text
User input / files
  -> source_ingestor
  -> source manifest + missing list
  -> workflow runtime
  -> subagent tasks and deterministic tools
  -> artifacts
  -> qa_reviewer gate
  -> final package
  -> CLI/Web/Desktop preview
```

Artifacts should be written under a project-local RAILWISE output directory unless the user provides a destination. Each artifact record should include source node and dependency metadata so QA can trace how a final number or paragraph was produced.

## Error Handling

- Missing required files: workflow pauses and asks for missing files instead of hallucinating.
- Unsupported document format: source ingestor explains accepted conversion paths.
- Tool parse failure: record failed artifact, include offending row/file/page, and route to QA or user.
- Calculation precondition failure: `adjustment_computer` returns a structured missing-input list.
- Standards uncertainty: `norm_librarian` marks "需规范库复核" instead of inventing article numbers.
- QA rejection: route back to the producing node with exact issues; stop after two failed revisions.
- Export failure: preserve Markdown/XLSX intermediate artifacts and report the failed conversion step.

## Testing And Verification

Tests must run from package directories, not repo root.

Core tests:
- `packages/railwise`: workflow scheduler, node dependency handling, QA rejection loops, artifact records.
- `packages/railwise`: skill command wrapper does not inject full skill content.
- `packages/railwise`: tool registry loads all required RAILWISE tools, deduplicates IDs, and reports failed external dependency tools.
- `packages/railwise`: `report_export` produces valid DOCX archives and expected XML parts.
- `packages/railwise`: `excel_export` produces valid XLSX archives for monitoring tables.

Business golden tests:
- Monitoring monthly report fixture.
- CPIII control-network fixture.
- Bid proposal fixture.
- Standards ingestion fixture.
- Office/CAD extraction fixture.

Manual acceptance:
- Run a monitoring report workflow from CLI.
- Confirm produced DOCX/XLSX can open in Office/WPS.
- Confirm QA reviewer can reject and trigger a revision.
- Confirm Desktop/Web can display workflow state without owning workflow logic.

## Implementation Phases

### Phase 1: Core Hardening

Scope:
- Context slimming.
- Skill command wrapper.
- Tool registry dedupe and diagnostics.
- External dependency tool loading fix.
- Required RAILWISE tool inventory test.
- `report_export` DOCX smoke verification and template roadmap test.

Success:
- Full business tool inventory loads once.
- Skills are available without full-content slash command injection.
- `report_export` and `excel_export` have repeatable package-level verification.

### Phase 2: Workflow Runtime

Scope:
- Core workflow run model.
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

Success:
- Source ingestor can summarize common office documents and engineering drawings into auditable inputs.

### Phase 4: Engineering Deliverables

Scope:
- DOCX templates.
- XLSX report package.
- PPTX briefing output.
- Optional PDF export.

Success:
- RAILWISE can produce office-ready artifacts for the major business lines.

### Phase 5: Thin Client Alignment

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
2. Tool SDK and registry hardening.
3. `report_export` engineering baseline.

This slice is small enough to land safely and unlocks the rest of the business workflow work.

## Acceptance Criteria

- RAILWISE's core business logic is documented as CLI/Core owned.
- Desktop is explicitly out of scope for business logic implementation.
- All five business lines are represented.
- Office and CAD input/output requirements are defined.
- Pi-inspired prompt slimming is captured as an architecture requirement.
- The next implementation slice is specific and testable.
