# opencode v1.17.8 Sync Audit

Generated from `v1.17.0..v1.17.8` on 2026-06-19.

## Summary

- Latest upstream production tag reviewed: `v1.17.8`.
- Changed files in scoped paths: 245.
- Upstream package path: `packages/opencode`.
- Railwise package path: `packages/railwise`.
- Direct git merge-base with Railwise HEAD: none expected for this fork snapshot.

## Change Statuses

| Status | Files |
| ------ | ----: |
| M      |   201 |
| A      |    33 |
| D      |     9 |
| R      |     2 |

## Changed Scopes

| Scope               | Files |
| ------------------- | ----: |
| `packages/app`      |   115 |
| `packages/opencode` |    90 |
| `packages/ui`       |    34 |
| `packages/sdk`      |     4 |
| `bun.lock`          |     1 |
| `package.json`      |     1 |

## Backend Modules Changed

| `packages/opencode/src` module | Files |
| ------------------------------ | ----: |
| `cli`                          |    16 |
| `server`                       |     7 |
| `plugin`                       |     5 |
| `mcp`                          |     3 |
| `session`                      |     3 |
| `acp`                          |     2 |
| `agent`                        |     2 |
| `provider`                     |     2 |
| `tool`                         |     2 |
| `config`                       |     1 |
| `project`                      |     1 |
| `pty-preparation.ts`           |     1 |
| `shell`                        |     1 |
| `snapshot`                     |     1 |
| `util`                         |     1 |

## Mapping Coverage

- Upstream `packages/opencode` changes: 90.
- Existing mapped Railwise files: 26.
- Missing mapped Railwise files: 64.

Railwise does not carry upstream `account`, `background`, `control-plane`, `effect`, `git`, `image`, or `sync` modules in the same shape. Railwise-only modules include `bot`, `control`, `harness`, `marketplace`, `math`, `memory`, `norm`, `parser`, and `scheduler`.

## Ported In This Batch

- Copilot plugin now passes configured provider headers through model fetches.
- Local `railwise run` internal fetches now attach the server authorization header.
- MCP tool schema transformation now defaults missing object `properties` to `{}`.
- OpenAI/Azure tool schemas are sanitized for boolean schemas, missing `type`, `const`, composition keys, and missing array `items`.
- Command templates that already include an attached file no longer inject the same file again through `$ARGUMENTS`.

## Deferred

- Full upstream app-shell v2 routing and session timeline changes, because they touch app/global sync areas where Railwise has Agent Studio and domain workflow extensions.
- Upstream effect/core service split, because Railwise still carries the current `packages/railwise` service layout plus Railwise-only domain modules.
- Upstream stats, docs, web, release, and GitHub automation changes, because they would overwrite Railwise release boundaries and Desktop split documentation.

## Recommended Next Sync Order

1. Build and package scripts: keep Railwise naming, import only Windows/macOS build fixes.
2. Config and schema: migrate tolerant parsing, permission/model/schema fixes, then regenerate SDK.
3. Server and session runtime: migrate event stream, question, and status handling that maps cleanly to Railwise.
4. Tool/plugin/provider layer: continue porting MCP/tool compatibility and provider request fixes.
5. App shell: port prompt input, terminal websocket, global sync, and settings fixes while preserving Railwise Agent Studio.
