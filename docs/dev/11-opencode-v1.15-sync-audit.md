# opencode v1.15.3 Sync Audit

Generated from v1.4.5..v1.15.3.

## Summary

- Changed files in scoped paths: 1169
- Upstream package path: packages/opencode
- Railwise package path: packages/railwise
- Direct git merge-base with Railwise HEAD: none expected for this fork snapshot

## Change Statuses

| Status | Files |
| --- | ---: |
| M | 609 |
| A | 426 |
| D | 130 |
| R | 4 |

## Changed Scopes

| Scope | Files |
| --- | ---: |
| packages/opencode | 918 |
| packages/ui | 123 |
| packages/app | 115 |
| packages/sdk | 11 |
| bun.lock | 1 |
| package.json | 1 |

## Backend Modules Changed

| packages/opencode/src module | Files |
| --- | ---: |
| cli | 190 |
| server | 105 |
| tool | 45 |
| provider | 34 |
| util | 30 |
| config | 25 |
| session | 24 |
| control-plane | 14 |
| effect | 14 |
| plugin | 11 |
| project | 11 |
| file | 7 |
| lsp | 7 |
| v2 | 5 |
| agent | 4 |
| mcp | 4 |
| pty | 4 |
| sync | 4 |
| account | 3 |
| acp | 3 |
| bus | 3 |
| permission | 3 |
| skill | 3 |
| storage | 3 |
| command | 2 |
| format | 2 |
| installation | 2 |
| question | 2 |
| reference | 2 |
| share | 2 |
| audio.d.ts | 1 |
| auth | 1 |
| background | 1 |
| data-migration.sql.ts | 1 |
| data-migration.ts | 1 |
| env | 1 |
| event-v2-bridge.ts | 1 |
| filesystem | 1 |
| flag | 1 |
| git | 1 |
| global | 1 |
| id | 1 |
| ide | 1 |
| image | 1 |
| index.ts | 1 |
| markdown.d.ts | 1 |
| node.ts | 1 |
| npm | 1 |
| patch | 1 |
| shell | 1 |
| snapshot | 1 |
| temporary.ts | 1 |
| worktree | 1 |

## App Areas Changed

| packages/app/src area | Files |
| --- | ---: |
| context | 29 |
| components | 28 |
| pages | 20 |
| i18n | 17 |
| utils | 12 |
| addons | 2 |
| app.tsx | 1 |
| entry.tsx | 1 |
| env.d.ts | 1 |
| index.css | 1 |

## Railwise Mapping Coverage

- Upstream packages/opencode changes: 918
- Existing mapped Railwise files: 314
- Missing mapped Railwise files: 604

## Upstream Modules Missing In Railwise

- account
- background
- control-plane
- effect
- git
- image
- reference
- sync
- v2

## Railwise-Only Modules

- bun
- control
- flag
- global
- memory
- norm
- scheduler

## Recommended Migration Order

1. Build and package scripts: keep Railwise naming, import upstream Windows/macOS build fixes only.
2. Config and schema: migrate tolerant parsing, permission/model/schema fixes, then regenerate SDK.
3. Server and session runtime: migrate API shape fixes, session sync, question handling, and event stream fixes.
4. Tool/plugin/provider layer: migrate MCP/tool compatibility and provider request fixes.
5. App shell: migrate prompt input, terminal websocket, global sync, and settings fixes while preserving Railwise agent studio.
6. Validation: run package typecheck, focused tests, desktop build, and installer smoke checks.

## Task 3 Config/Schema Decision

Upstream v1.15.3 moved much of config and permission parsing into new `@opencode-ai/core` and Effect-based modules. Railwise does not currently have that package split, so a wholesale port would be a high-risk architecture migration rather than a safe compatibility patch.

For this sync batch, Railwise ports the immediately actionable compatibility layer only:

- Preserve strict validation for unknown user config fields.
- Ignore Railwise Desktop metadata fields `version` and `system` during config validation.
- Accept deprecated grouped `tools` config values like `{ "surveying": ["rw_chainage_convert"] }`.
- Normalize grouped tools into boolean tool toggles so existing legacy `tools` to `permission` migration still applies.

The full Effect/core config split remains a separate migration batch.

## Task 4 Runtime Decision

Upstream v1.15.3 replaces the old instance server layout with a new route-group HTTP API and Effect-backed session services. Railwise still has desktop-specific routes, agent studio endpoints, and sidecar assumptions on the current server structure, so a wholesale route/session port is deferred.

For this sync batch, Railwise ports isolated runtime fixes that fit the current architecture:

- Cap retry delays from `retry-after` and `retry-after-ms` headers at the runtime timer limit.
- Retry provider API errors with 5xx status codes even when provider SDK metadata does not mark the error retryable.
- Prefer `RAILWISE_TEST_HOME` over `RAILWISE_HOME` so server tests remain isolated when a developer shell has a real Railwise home configured.

## Task 5 MCP/Tooling Decision

Upstream v1.15.3 includes a broad MCP, tool, plugin, and provider rewrite that also depends on new Effect services and `@opencode-ai/core` modules. Railwise should not wholesale port that layer until the core package split is planned.

For this sync batch, Railwise ports the highest-signal MCP compatibility fix first:

- If `client.listTools()` fails because an external MCP server returns an invalid or unresolvable `outputSchema`, Railwise retries `tools/list` with a tolerant schema.
- The fallback drops only the invalid output schema metadata and preserves the tool name, description, and input schema.
- Non-schema MCP failures still mark the server failed, preserving existing error behavior.

Remaining Task 5 work: provider request compatibility, plugin validation drift, and tool argument validation.

Verification for this MCP slice:

- `bun test test/mcp --timeout 30000`
- `bun test test/tool test/provider test/plugin test/mcp --timeout 30000`
- `bun run typecheck`
