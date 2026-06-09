# RAILWISE Decoupled Release SOP

This repository now keeps three release surfaces connected by artifacts instead of source coupling.

## CLI Upstream Sync

Generate a clean rebrand baseline from an upstream tag:

```bash
bun run sync:upstream -- --to v1.16.2 --dry-run
bun run sync:upstream -- --to v1.16.2
```

Because the fork mirrors upstream version numbers, local release tags (e.g. `v1.2.8`) collide with upstream's identically named tags. The script fetches the requested ref into `refs/railwise-sync/<tag>` instead of `refs/tags/<tag>`, so it never clobbers a local tag and always checks out upstream's commit. Do **not** run `git fetch upstream --tags` manually — it will fail with "would clobber existing tag".

Then rebase Railwise work onto that baseline:

```bash
git switch dev
git rebase --onto sync/v1.16.2 sync/v1.2.8 dev
bun run rebrand:audit
```

`scripts/rebrand.config.json` is the deterministic brand map. Keep custom Railwise code in new files or packages where possible so future rebases only conflict on real feature changes.

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

### Publishing from CI (recommended)

The `publish-shared` workflow (`.github/workflows/publish-shared.yml`) publishes the shared packages using the repository's `NPM_TOKEN` secret, so no local `npm login` is required. Trigger it from the Actions tab (`workflow_dispatch`):

- `version` — the version to publish. Defaults to `packages/desktop/.cli-version` so the shared packages line up with the pinned CLI.
- `dry_run` — defaults to `true` (runs `npm publish --dry-run`). Set it to `false` to perform a real publish.

The workflow sets `RAILWISE_CHANNEL=latest`, so released packages are tagged `latest`. Run it once with `dry_run=true` to verify the staged tarballs, then re-run with `dry_run=false` to publish.

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
