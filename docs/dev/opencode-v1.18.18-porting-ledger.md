# OpenCode v1.18.18 Porting Ledger

Target: `v1.18.18` (`31406ccc51b4bd2a4e1e086b2bcaa5f7f804f26d`)

Reviewed baseline: `v1.17.8` (`11e47f91496005aab4d7c5a2d0a7da5d2651b4ac`)

Status meanings:

- `ported`: implemented and covered by Railwise validation.
- `partial`: selected changes are ported, but the release is not fully mirrored.
- `deferred`: valid upstream behavior that needs a separate product decision.
- `not_applicable`: belongs to upstream infrastructure or the standalone Desktop repository.

| Release  | Core / CLI decision                                                                         | App / Desktop decision                                          |
| -------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| v1.18.0  | `not_applicable` (Desktop-only release)                                                     | `not_applicable` (Desktop v2 stays in `railwise-desktop-app`)   |
| v1.18.1  | `not_applicable`                                                                            | `not_applicable` (Desktop settings spacing)                     |
| v1.18.2  | `deferred` (subagent depth policy and Meta defaults)                                        | `not_applicable`                                                |
| v1.18.3  | `deferred` (TUI picker shortcut)                                                            | `not_applicable`                                                |
| v1.18.4  | `deferred` (Kimi adaptive thinking and prompt routing require provider-specific evaluation) | `not_applicable`                                                |
| v1.18.5  | `deferred` (Mistral reasoning requires an AI SDK dependency upgrade)                        | `not_applicable`                                                |
| v1.18.6  | `deferred` (branch-specific repository cache isolation)                                     | `not_applicable`                                                |
| v1.18.7  | `not_applicable`                                                                            | `not_applicable` (Desktop/UI-only release)                      |
| v1.18.8  | `deferred` (MCP OAuth and Gemini sampling changes need separate compatibility review)       | `not_applicable`                                                |
| v1.18.9  | `deferred` (legacy MCP SDK compatibility)                                                   | `not_applicable`                                                |
| v1.18.10 | `deferred` (Modal model discovery)                                                          | `not_applicable`                                                |
| v1.18.11 | `partial` (MCP SSE reconnect and interleaved reasoning fields ported)                       | `not_applicable`                                                |
| v1.18.12 | `partial` (Azure GPT-5.5 reasoning compatibility ported)                                    | `not_applicable`                                                |
| v1.18.13 | `deferred` (PR review context in TUI)                                                       | `not_applicable`                                                |
| v1.18.14 | `partial` (retry behavior ported; ACP and remote workspace changes deferred)                | `not_applicable`                                                |
| v1.18.15 | `partial` (message chronology and truncation cleanup ported; full compaction deferred)      | `not_applicable`                                                |
| v1.18.16 | `partial` (tolerant top-level config parsing ported)                                        | `not_applicable` (Home project registration belongs to Desktop) |
| v1.18.17 | `partial` (retry/provider fixes ported; compaction, Mistral and Copilot PDF deferred)       | `not_applicable`                                                |
| v1.18.18 | `partial` (xAI `xhigh` reasoning ported; Kimi prompt routing deferred)                      | `not_applicable`                                                |

## Current Batch

| Upstream commit      | Status   | Railwise decision                                                                                      |
| -------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `c789868`            | `ported` | Cap retries at five and add 25% jitter to exponential backoff.                                         |
| `38e10eb`            | `ported` | Ignore unknown top-level configuration fields while preserving validation for known and nested fields. |
| `a1ab489`            | `ported` | Accept `reasoning_text` and provider-defined interleaved reasoning fields.                             |
| `c1ee3c6`            | `ported` | Stop MCP SSE reconnection after a JSON-RPC error response.                                             |
| `87481f2`            | `ported` | Remove incompatible `reasoningEffort` from Azure GPT-5.5+ completion requests.                         |
| `db581e4`, `a54a693` | `ported` | Order revert, fork, and session exit behavior by message time, using ID only as a tie-breaker.         |
| `d468201`            | `ported` | Clean truncated output files by modification time.                                                     |
| `502310f`            | `ported` | Pass `xhigh` reasoning effort through the xAI SDK.                                                     |
| `6fea419`            | `ported` | Pass provider-defined reasoning effort through the Groq SDK.                                           |

Dependency-level fixes are maintained as Bun patches for `@modelcontextprotocol/sdk@1.29.0`, `@ai-sdk/xai@2.0.51`, and `@ai-sdk/groq@2.0.34` until the corresponding dependency upgrades are adopted.

## Deferred Decisions

| Area                                      | Status           | Reason                                                                                                                         |
| ----------------------------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Kimi adaptive thinking and prompt routing | `deferred`       | Provider-specific prompts must be checked against Railwise's Chinese prompts and Agent Pack behavior.                          |
| Mistral reasoning effort                  | `deferred`       | The locked `@ai-sdk/mistral@2.0.27` has no reasoning-effort request path; changing only the enum would be ineffective.         |
| Full compaction rewrite                   | `deferred`       | It changes history retention and token accounting and therefore needs migration and historical-session compatibility coverage. |
| Copilot PDF input                         | `deferred`       | It needs an explicit product decision plus attachment, transport, and Desktop validation.                                      |
| Desktop v2                                | `not_applicable` | Railwise Desktop remains independently maintained until the workbench feature set is locked.                                   |

## Existing Ports

The exact upstream and Railwise commit mapping is maintained in `scripts/upstream-state.json`. The v1.17.8 audit remains the evidence for the previous batch.

## Validation Gate

A row can move to `ported` only after focused tests, `packages/railwise` tests, App unit/E2E tests, repository typecheck, SDK regeneration, and cross-platform CLI build checks pass. Recording `v1.18.18` as reviewed is a separate action from marking individual rows as ported.

Local validation completed on 2026-08-14: Railwise unit tests, App unit tests, repository typecheck, SDK regeneration, all CLI build targets, and the native `railwise --version` smoke test passed. Linux and Windows App E2E remain a required CI gate because they cannot be represented by the local macOS run.
