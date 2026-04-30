# RAILWISE Core and CLI

`packages/railwise` contains the shared RAILWISE Core engine and the RAILWISE CLI product entry.

Core owns agents, workflows, norm wiki, survey tools, sessions, server routes, and delivery package contracts.

CLI owns terminal commands, scripting, CI usage, provider setup, debug commands, and headless automation.

Desktop uses this package as a local sidecar, but Desktop product UX belongs in `packages/desktop`.

See [docs/dev/00-product-boundaries.md](../../docs/dev/00-product-boundaries.md).

## Development

To install dependencies:

```bash
bun install
```

To run the CLI:

```bash
bun run index.ts
```

Headless workflow commands are JSON-first for scripts and CI:

```bash
bun run index.ts workflow run cpiii-resurvey-wiki --input-json '{"project":"CPIII resurvey"}' --wait
bun run index.ts workflow export <session-id> --workflow cpiii-resurvey-wiki
```

`--wait` checks delivery acceptance and returns a non-zero exit code when `ok=false`. `--archive` writes the delivery package after acceptance passes and returns the summary, manifest, and artifact paths.

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
