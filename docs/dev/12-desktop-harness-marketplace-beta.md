# Desktop Harness Marketplace Beta QA

## Scope

This checklist verifies the Codex-style Desktop beta surface:

- Workbench is the first screen.
- Harness runtime state is visible.
- Marketplace lists capabilities with permission metadata.
- Legacy dashboard and zero-counter first screen do not reappear.

## Manual QA Script

1. Launch Desktop.
2. Confirm the first screen is Workbench.
3. Confirm there are no large zero counters on the first screen.
4. Choose a local test directory.
5. Enter: `检查当前目录中的测量资料，列出缺失文件。`
6. Confirm a session opens.
7. Confirm the Harness panel shows mode, model, workspace, capabilities, and permission posture.
8. Open Marketplace.
9. Confirm built-in capabilities are visible with source, version, permissions, and risk labels.
10. Open Harness.
11. Confirm the runtime console shows status, permission gate, and timeline empty state.
12. Return to Workbench.

## Automated Verification

Run from package directories, not the repository root.

```bash
cd packages/railwise
bun test test/harness/schema.test.ts test/marketplace/service.test.ts test/server/harness.test.ts test/server/marketplace.test.ts --timeout 30000

cd ../app
bun test --preload ./happydom.ts ./src/pages/workbench ./src/pages/marketplace ./src/components/harness-timeline.test.tsx
bun run typecheck

cd ../desktop
bun run typecheck
bun run build
bun run test:e2e -- 01-startup.spec.ts 11-visual-regression.spec.ts --workers=1
```

Expected result: all commands pass.

## Browser QA

Use the desktop dev server or Playwright-backed browser QA.

Desktop viewport:

- Width: `1440`
- Height: `900`
- Check `/home`, `/marketplace`, and `/harness`.

Compact viewport:

- Width: `390`
- Height: `844`
- Check `/home`, `/marketplace`, and `/harness`.

Acceptance:

- No overlapping text.
- No first-screen zero counters.
- Composer is visible without scrolling on Workbench.
- Marketplace cards remain readable.
- Harness status and timeline remain readable.

## Current Beta Result

Verified on 2026-06-01:

- Backend Harness and Marketplace tests passed.
- App Workbench, Marketplace, and Harness component tests passed.
- App and Desktop typechecks passed.
- Desktop build passed.
- Desktop startup and dashboard-redirect E2E tests passed.
- Browser QA passed for `/home`, `/marketplace`, and `/harness` at `1440x900` and `390x844`.

Browser QA screenshots were written to `/tmp/railwise-desktop-browser-qa`.
