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

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
