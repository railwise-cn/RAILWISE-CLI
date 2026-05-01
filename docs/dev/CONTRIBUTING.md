# RAILWISE 开发指南

默认分支是 `dev`。本仓库测试不能从根目录运行，请进入对应 package 后执行。

产品边界以 `docs/dev/00-product-boundaries.md` 为准。提交前先判断改动属于 `core`、`cli`、`desktop`、`app`、`docs` 还是 `ci/release`。

## 开发环境

```bash
bun install
cd packages/desktop
bun run dev
```

Desktop 壳使用 Tauri 2，前端使用 SolidJS 和 Vite。浏览器 harness 可直接启动当前源码进行 UI 验收，但 Desktop GA 验收必须经过原生 Tauri 壳。

## 常用命令

```bash
cd packages/app && bun run typecheck
cd packages/desktop && bun run typecheck
cd packages/desktop && bun run check:tauri
cd packages/desktop && bun run test:tauri
bun run script/verify-desktop-native-surfaces.ts
cd packages/desktop && bun run smoke:tauri
cd packages/desktop && bun run build
cd packages/desktop && bun run test:e2e
```

M7 验收和发版节奏见 `docs/dev/06-m7-acceptance.md` 与 `docs/dev/05-release-cadence.md`。

## 代码规范

优先沿用现有模块结构。变量和函数名保持简洁，避免无意义抽象。新增 UI 必须提供稳定的 `data-testid`，便于 Playwright 验收。

## PR 要求

每个 PR 必须在模板中勾选产品线：

- `Core`: 引擎、API、SDK、Agent、workflow、norm wiki、tool、session、delivery package。
- `CLI`: 命令行、脚本化、CI/headless、debug/setup/provider flows。
- `Desktop`: Tauri、dashboard、workspace、Agent Studio、installer、signing、notarization、updater。
- `App shell`: `packages/app` 共享 UI，不能承诺 Desktop-only 产品体验。
- `Docs`: 用户、开发、发布、产品边界文档。
- `CI / release`: GitHub Actions、发布、签名、部署。

PR 标题使用 conventional commit 风格，例如 `feat(core): ...`、`feat(cli): ...`、`feat(desktop): ...`、`docs(product): ...`。多产品线 PR 必须说明为什么这些改动必须一起发。
