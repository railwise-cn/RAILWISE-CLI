# RAILWISE Decoupled Release SOP

This repository keeps Core, CLI, SDK, shared App Shell packages, and Agent Pack connected by artifacts instead of Desktop source coupling.

## CLI Upstream Sync

Audit a stable upstream tag without changing branches or tracked source files:

```bash
bun run sync:upstream -- --to v1.18.18 --dry-run
bun run sync:upstream -- --to v1.18.18
bun run sync:upstream -- --to v1.18.18 --write
bun run sync:upstream -- --to v1.18.18 --write --api
```

The script fetches the reviewed and target tags into `refs/railwise-sync/<tag>`, runs the scoped Core/App/SDK audit, and prints or writes the report. If Git transport is unavailable, it falls back to GitHub API trees; pass `--api` to select that mode directly. It never checks out an upstream tree, creates a rebrand branch, deletes files, or rebases Railwise history. Local Railwise release tags therefore cannot collide with upstream tags.

After the report has been reviewed and every release item is classified in the porting ledger, explicitly record the reviewed tag:

```bash
bun run sync:upstream -- --to v1.18.18 --write --record
```

`scripts/upstream-state.json` separately records the latest reviewed tag and exact upstream-to-Railwise commit mappings. A reviewed tag does not imply that every upstream change was ported.

### Current Sync Audit

Railwise history is rooted at a product import and has no usable merge base with the generated `sync/*` snapshots. Previous rebase trials produced repository-wide add/add conflicts. Upstream changes must therefore be ported as reviewed, focused commits onto `dev`; generated snapshots remain audit inputs only.

Generated and pushed baselines:

- `sync/v1.3.17`
- `sync/v1.4.14`
- `sync/v1.14.51`
- `sync/v1.15.13`
- `sync/v1.16.2`
- `sync/v1.17.0`

Latest scoped audit:

- `docs/dev/12-opencode-v1.17.8-sync-audit.md`
- `docs/dev/opencode-v1.18.18-sync-audit.md`
- `docs/dev/opencode-v1.18.18-porting-ledger.md`

## Agent Pack

Extract `.railwise` assets into a GitHub Release package:

```bash
bun run assets:extract -- --out ../railwise-agent-pack --name @railwise/agent-pack --force
cd ../railwise-agent-pack
bun pm pack
```

Validate the generated installer:

```bash
node ../railwise-agent-pack/bin/install.js list
node ../railwise-agent-pack/bin/install.js where --target codex
node ../railwise-agent-pack/bin/install.js install --target ~/.railwise --dry-run
```

Default extraction excludes `*.test.*` tool files from the install manifest and includes templates/themes. Use `--include-tests` only when preparing a developer fixture package.

Agent Pack is not a standalone npm package. The CLI release workflow embeds the default business Agent Pack inside `railwise-ai` so `npm install -g railwise-ai` installs a complete CLI + Agent Pack experience, and also uploads `railwise-agent-pack-<version>.tgz` to the GitHub Release for Codex, Claude, OpenCode, Desktop, or operators that need the exact pinned asset bundle.

## Shared Packages

CLI releases pack the generated SDK and shared frontend packages that Desktop consumes:

```bash
bun run pack:shared
```

`pack:shared` writes tarballs and `manifest.json` under `dist/shared-packages`. The main `publish` workflow uploads those files to the GitHub Release. Do not publish `@railwise/sdk`, `@railwise/ui`, `@railwise/util`, or `@railwise/app` to npm as part of the normal CLI release.

The npm install surface is intentionally narrow:

- `railwise-ai` is the single user-facing CLI package.
- `railwise-*` platform packages are internal optional dependencies selected by npm during CLI install.
- Agent Pack is embedded in the npm CLI package and also published as a versioned GitHub Release asset.

Only introduce a separate npm publish path for `@railwise/*` if there is a concrete external SDK/library distribution requirement.

## Desktop Split

Desktop has been moved to the standalone `railwise-desktop-app` repository. This CLI repository no longer owns `packages/desktop`, Tauri workflows, Desktop verification scripts, or Desktop release gates.

Desktop consumes this repository through artifacts:

- CLI binary release assets, pinned by Desktop `.cli-version`.
- SDK tarball, generated from the CLI server API and uploaded to the CLI GitHub Release.
- Shared frontend package tarballs uploaded to the CLI GitHub Release.
- Agent Pack tarball exported from `.railwise` and uploaded to the CLI GitHub Release.

The old snapshot export helper was a migration tool and was removed with the monorepo Desktop workspace. Future Desktop changes should land in `railwise-desktop-app`; this repository should only change when Core/API/shared package contracts or Agent Pack assets need to move.

## Release Contract

- CLI owns OpenAPI generation, SDK/shared package release tarballs, CLI npm packages, and CLI binary release assets.
- Agent assets live inside the npm CLI package for the default Railwise install and in the GitHub Release Agent Pack tarball for Railwise, upstream-compatible layouts, Codex, Claude, or a custom path.
- Desktop owns Tauri packaging and pins CLI with `.cli-version`; upgrading CLI is a version-file change plus Desktop regression tests.
