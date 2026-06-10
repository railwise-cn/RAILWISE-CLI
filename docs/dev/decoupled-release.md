# RAILWISE Decoupled Release SOP

This repository now keeps three release surfaces connected by artifacts instead of source coupling.

## CLI Upstream Sync

Generate a clean rebrand baseline from an upstream tag:

```bash
bun run sync:upstream -- --to v1.16.2 --dry-run
bun run sync:upstream -- --to v1.16.2
```

Then rebase Railwise work onto that baseline:

```bash
git switch dev
git rebase --onto sync/v1.16.2 <previous-sync-base> dev
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

That trial currently stops on `980d8f390 feat(desktop): add GA release readiness` with 90 conflicted files, mostly in `packages/web`, `packages/app`, `packages/railwise`, and `packages/desktop`. Resolve that commit by topic before continuing to later sync baselines.

Generated and pushed baselines:

- `sync/v1.3.17`
- `sync/v1.4.14`
- `sync/v1.14.51`
- `sync/v1.15.13`
- `sync/v1.16.2`

## Agent Pack

Extract `.railwise` assets into a publishable package:

```bash
bun run assets:extract -- --out ../railwise-agent-pack --name @railwise/agent-pack --force
```

Validate the generated installer:

```bash
node ../railwise-agent-pack/bin/install.js list
node ../railwise-agent-pack/bin/install.js where --target codex
node ../railwise-agent-pack/bin/install.js install --target ~/.railwise --dry-run
```

Default extraction excludes `*.test.*` tool files from the install manifest and includes templates/themes. Use `--include-tests` only when preparing a developer fixture package.

## Shared Packages

CLI releases publish the shared frontend packages that Desktop consumes:

```bash
bun run publish:shared
```

The script defaults to npm `--dry-run`. CI must pass `--publish` for a real publish. Versions come from `@railwise/script`, and preview channels are normalized for npm-safe semver and dist-tags.

Published package versions should match the CLI version that generated the SDK.

## Desktop Split

Export a standalone Desktop repository snapshot:

```bash
bun run desktop:export -- --out ../railwise-desktop-app --cli-version 1.2.8 --shared-version 1.2.8 --force
```

The export rewrites `workspace:*` and `catalog:` dependencies into npm-compatible versions, adds a standalone Desktop release workflow, and uses `.cli-version` to download the CLI sidecar from the `railwise-cn/RAILWISE-CLI` GitHub release.

For full history migration, retry with:

```bash
bun run desktop:export -- --out ../railwise-desktop-app --history --force
```

If `git-filter-repo` is killed on this large repo, use the snapshot export first and run history migration later on a machine or CI runner with more memory.

## Release Contract

- CLI owns OpenAPI generation, `@railwise/sdk`, shared packages, and CLI binary release assets.
- Agent assets live in `@railwise/agent-pack` and install into Railwise, upstream-compatible layouts, Codex, Claude, or a custom path.
- Desktop owns Tauri packaging and pins CLI with `.cli-version`; upgrading CLI is a version-file change plus Desktop regression tests.
