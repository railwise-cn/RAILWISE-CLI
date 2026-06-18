# RAILWISE Decoupled Release SOP

This repository keeps Core, CLI, SDK, shared App Shell packages, and Agent Pack connected by artifacts instead of Desktop source coupling.

## CLI Upstream Sync

Generate a clean rebrand baseline from an upstream tag:

```bash
bun run sync:upstream -- --to v1.17.0 --dry-run
bun run sync:upstream -- --to v1.17.0
```

Because the fork mirrors upstream version numbers, local release tags such as `v1.2.8` collide with upstream's identically named tags. The sync script fetches the requested ref into `refs/railwise-sync/<tag>` instead of `refs/tags/<tag>`, so it never clobbers a local tag and always checks out upstream's commit. Do not run `git fetch upstream --tags` manually; it can fail with "would clobber existing tag".

Then rebase Railwise work onto that baseline:

```bash
git switch dev
git rebase --onto sync/v1.17.0 <previous-sync-base> dev
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

The script defaults to npm `--dry-run`. CI must pass `--publish` for a real publish. Versions come from `@railwise/script`, and preview channels are normalized for npm-safe semver and dist-tags. Published package versions should match the CLI version that generated the SDK.

### Publishing from CI

The `publish-shared` workflow (`.github/workflows/publish-shared.yml`) publishes the shared packages using the repository's `NPM_TOKEN` secret, so no local `npm login` is required. Trigger it from the Actions tab with `workflow_dispatch`:

- `version`: optional explicit version. When omitted, `@railwise/script` computes the version from the normal CLI release rules.
- `dry_run`: defaults to `true`; set it to `false` to perform a real publish.

The workflow sets `RAILWISE_CHANNEL=latest`, so released packages are tagged `latest`. Run it once with `dry_run=true` to verify the staged tarballs, then re-run with `dry_run=false` to publish.

## Desktop Split

Desktop has been moved to the standalone `railwise-desktop-app` repository. This CLI repository no longer owns `packages/desktop`, Tauri workflows, Desktop verification scripts, or Desktop release gates.

Desktop consumes this repository through artifacts:

- CLI binary release assets, pinned by Desktop `.cli-version`.
- `@railwise/sdk`, generated from the CLI server API.
- Shared frontend packages published or packed from this repository.
- Agent Pack assets exported from `.railwise`.

The old snapshot export helper was a migration tool and was removed with the monorepo Desktop workspace. Future Desktop changes should land in `railwise-desktop-app`; this repository should only change when Core/API/shared package contracts or Agent Pack assets need to move.

## Release Contract

- CLI owns OpenAPI generation, `@railwise/sdk`, shared packages, and CLI binary release assets.
- Agent assets live in `@railwise/agent-pack` and install into Railwise, upstream-compatible layouts, Codex, Claude, or a custom path.
- Desktop owns Tauri packaging and pins CLI with `.cli-version`; upgrading CLI is a version-file change plus Desktop regression tests.
