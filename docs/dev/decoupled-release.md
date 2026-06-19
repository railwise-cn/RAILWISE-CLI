# RAILWISE Decoupled Release SOP

This repository keeps Core, CLI, SDK, shared App Shell packages, and Agent Pack connected by artifacts instead of Desktop source coupling.

## CLI Upstream Sync

Generate a clean rebrand baseline from an upstream tag:

```bash
bun run sync:upstream -- --to v1.17.8 --dry-run
bun run sync:upstream -- --to v1.17.8
```

Because the fork mirrors upstream version numbers, local release tags such as `v1.2.8` collide with upstream's identically named tags. The sync script fetches the requested ref into `refs/railwise-sync/<tag>` instead of `refs/tags/<tag>`, so it never clobbers a local tag and always checks out upstream's commit. Do not run `git fetch upstream --tags` manually; it can fail with "would clobber existing tag".

Then rebase Railwise work onto that baseline:

```bash
git switch dev
git rebase --onto sync/v1.17.8 <previous-sync-base> dev
bun run rebrand:audit
```

`scripts/rebrand.config.json` is the deterministic brand map. Keep custom Railwise code in new files or packages where possible so future rebases only conflict on real feature changes.

### Current Sync Audit

The current `origin/dev` history is rooted at the large import commit:

```bash
7fb66d861 feat: v1.3.0 - Parallel Agent + PPT Master (#1)
```

That root commit is not descended from `sync/v1.2.8`, so this command is not valid for the current branch shape:

```bash
git rebase --onto sync/v1.16.2 sync/v1.2.8 dev
```

It attempts to replay the full repository import and produces add/add conflicts across the tree. The safer first pass is to skip the import root and replay Railwise changes after it:

```bash
git switch -c codex/rebase-v1.3.17-dev origin/dev
git rebase --onto sync/v1.3.17 7fb66d861
```

That trial currently stops on `980d8f390 feat(desktop): add GA release readiness` with 90 conflicted files, mostly in `packages/web`, `packages/app`, `packages/railwise`, and the historical `packages/desktop` tree. The current CLI branch has removed `packages/desktop`, so future sync work should treat Desktop history as a separate product line and replay only Core/CLI/shared-package changes into this repository.

Generated and pushed baselines:

- `sync/v1.3.17`
- `sync/v1.4.14`
- `sync/v1.14.51`
- `sync/v1.15.13`
- `sync/v1.16.2`
- `sync/v1.17.0`

Latest scoped audit:

- `docs/dev/12-opencode-v1.17.8-sync-audit.md`

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
