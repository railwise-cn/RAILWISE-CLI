# RAILWISE Desktop

RAILWISE Desktop is the native engineering survey AI workbench. It opens to a focused task composer where users choose a local project folder, describe the engineering job, and let the RAILWISE Harness route agents, tools, skills, model providers, and permissions.

It reuses RAILWISE Core through a local sidecar, but it is not positioned as a CLI wrapper. Desktop users should be able to complete the main workflow without knowing command-line commands.

Product boundaries are documented in [docs/dev/00-product-boundaries.md](../../docs/dev/00-product-boundaries.md).

## Development

From the repo root:

```bash
bun install
bun run --cwd packages/desktop tauri dev
```

This starts the Vite dev server on http://localhost:1420 and opens the native window.

If you only want the web dev server (no native shell):

```bash
bun run --cwd packages/desktop dev
```

Use this only for UI iteration. Desktop acceptance must run through the native Tauri shell because sidecar startup, local file commands, updater behavior, and platform integration are part of the product.

To verify the native shell without building a real sidecar binary:

```bash
bun run --cwd packages/desktop check:tauri
bun run --cwd packages/desktop test:tauri
bun run script/verify-desktop-native-surfaces.ts
bun run --cwd packages/desktop smoke:tauri
```

`check:tauri` and `test:tauri` prepare a local check-only sidecar stub before running `cargo check` or `cargo test`.
`script/verify-desktop-native-surfaces.ts` verifies that file, updater, window, and menu capabilities remain owned by the Desktop/Tauri boundary.
`smoke:tauri` opens the real Tauri shell with a temporary local sidecar and verifies `/global/health` plus native lifecycle logs, so GA acceptance is not reduced to a browser preview.

## Build

To create a production `dist/` and build the native app bundle:

```bash
bun run --cwd packages/desktop tauri build
```

## Product Scope

Desktop owns:

- `/home` Workbench-first task composer, project folder handoff, recent sessions, and Harness summary
- `/harness` runtime console for planning, agent routing, tool calls, artifacts, and permission gates
- `/marketplace` capability marketplace for agents, tools, Skills, workflows, MCP connectors, model providers, and Harness profiles
- `/workspace` file import, preview, diff, and send-to-agent flows
- `/agents` advanced agent configuration for power users and debugging
- delivery package review and export
- native install, signing, notarization, crash recovery, and update UX

`/dashboard` is a compatibility redirect and must not reintroduce the old project cockpit or zero-counter first screen.

Desktop does not own CLI command design. CLI automation belongs in `packages/railwise/src/cli`.

## Prerequisites

Running the desktop app requires additional Tauri dependencies (Rust toolchain, platform-specific libraries). See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for setup instructions.
