# opencode v1.18.18 Sync Audit

Generated from v1.17.8..v1.18.18.

## Summary

- Changed files in scoped paths: 1421
- Upstream package path: packages/opencode
- Railwise package path: packages/railwise
- Direct git merge-base with Railwise HEAD: none expected for this fork snapshot

## Change Statuses

| Status | Files |
| ------ | ----: |
| M      |   873 |
| A      |   433 |
| D      |   115 |

## Changed Scopes

| Scope             | Files |
| ----------------- | ----: |
| packages/app      |   518 |
| packages/core     |   347 |
| packages/opencode |   299 |
| packages/ui       |   250 |
| packages/sdk      |     5 |
| bun.lock          |     1 |
| package.json      |     1 |

## Backend Modules Changed

| packages/opencode/src module | Files |
| ---------------------------- | ----: |
| cli                          |    22 |
| session                      |    19 |
| server                       |    16 |
| plugin                       |    10 |
| tool                         |    10 |
| acp                          |     9 |
| mcp                          |     6 |
| effect                       |     5 |
| project                      |     5 |
| account                      |     3 |
| config                       |     3 |
| provider                     |     3 |
| agent                        |     2 |
| lsp                          |     2 |
| question                     |     2 |
| share                        |     2 |
| skill                        |     2 |
| auth                         |     1 |
| background                   |     1 |
| command                      |     1 |
| control-plane                |     1 |
| env                          |     1 |
| event-manifest.ts            |     1 |
| event-v2-bridge.ts           |     1 |
| format                       |     1 |
| git                          |     1 |
| ide                          |     1 |
| image                        |     1 |
| installation                 |     1 |
| permission                   |     1 |
| snapshot                     |     1 |
| storage                      |     1 |
| sync                         |     1 |
| worktree                     |     1 |

## Core Modules Changed

| packages/core/src module | Files |
| ------------------------ | ----: |
| plugin                   |    44 |
| session                  |    27 |
| tool                     |    18 |
| config                   |     8 |
| public                   |     7 |
| database                 |     6 |
| effect                   |     6 |
| v1                       |     6 |
| project                  |     4 |
| filesystem               |     3 |
| pty                      |     3 |
| system-context           |     3 |
| github-copilot           |     2 |
| integration              |     2 |
| permission               |     2 |
| skill                    |     2 |
| util                     |     2 |
| account.ts               |     1 |
| agent.ts                 |     1 |
| aisdk.ts                 |     1 |
| background-job.ts        |     1 |
| catalog.ts               |     1 |
| command.ts               |     1 |
| config.ts                |     1 |
| control-plane            |     1 |
| credential               |     1 |
| credential.ts            |     1 |
| cross-spawn-spawner.ts   |     1 |
| event.ts                 |     1 |
| file-mutation.ts         |     1 |
| file.ts                  |     1 |
| filesystem.ts            |     1 |
| fs-util.ts               |     1 |
| git.ts                   |     1 |
| global.ts                |     1 |
| id                       |     1 |
| image.ts                 |     1 |
| instruction-context.ts   |     1 |
| integration.ts           |     1 |
| location-layer.ts        |     1 |
| location-mutation.ts     |     1 |
| location-service-map.ts  |     1 |
| location-services.ts     |     1 |
| location.ts              |     1 |
| model-request.ts         |     1 |
| model.ts                 |     1 |
| models-dev.ts            |     1 |
| npm.ts                   |     1 |
| oauth                    |     1 |
| observability.ts         |     1 |
| permission.ts            |     1 |
| plugin.ts                |     1 |
| policy.ts                |     1 |
| process.ts               |     1 |
| project.ts               |     1 |
| provider.ts              |     1 |
| pty.ts                   |     1 |
| public-event-manifest.ts |     1 |
| question.ts              |     1 |
| reference                |     1 |
| reference.ts             |     1 |
| repository-cache.ts      |     1 |
| repository.ts            |     1 |
| ripgrep                  |     1 |
| ripgrep.ts               |     1 |
| schema.ts                |     1 |
| session.ts               |     1 |
| skill.ts                 |     1 |
| snapshot.ts              |     1 |
| state.ts                 |     1 |
| tool-output-store.ts     |     1 |
| v2-schema.ts             |     1 |
| workspace.ts             |     1 |

## App Areas Changed

| packages/app/src area | Files |
| --------------------- | ----: |
| components            |   112 |
| pages                 |    86 |
| i18n                  |    65 |
| context               |    64 |
| utils                 |    32 |
| wsl                   |     7 |
| assets                |     4 |
| hooks                 |     3 |
| addons                |     2 |
| app.tsx               |     1 |
| constants             |     1 |
| desktop-menu.test.ts  |     1 |
| desktop-menu.ts       |     1 |
| entry.tsx             |     1 |
| env.d.ts              |     1 |
| index.css             |     1 |
| index.ts              |     1 |

## Railwise Mapping Coverage

- Upstream packages/opencode and packages/core changes: 646
- Existing mapped Railwise files: 126
- Missing mapped Railwise files: 520

## Upstream Modules Missing In Railwise

- account
- background
- control-plane
- credential
- database
- effect
- event
- filesystem
- git
- github-copilot
- image
- integration
- oauth
- observability
- reference
- ripgrep
- sync
- system-context
- v1

## Railwise-Only Modules

- bot
- bun
- control
- file
- global
- harness
- marketplace
- math
- memory
- norm
- parser
- scheduler
- shell

## Recommended Migration Order

1. Build and package scripts: keep Railwise naming, import upstream Windows/macOS build fixes only.
2. Config and schema: migrate tolerant parsing, permission/model/schema fixes, then regenerate SDK.
3. Server and session runtime: migrate API shape fixes, session sync, question handling, and event stream fixes.
4. Tool/plugin/provider layer: migrate MCP/tool compatibility and provider request fixes.
5. App shell: migrate prompt input, terminal websocket, global sync, and settings fixes while preserving Railwise agent studio.
6. Validation: run package typecheck, focused tests, desktop build, and installer smoke checks.
