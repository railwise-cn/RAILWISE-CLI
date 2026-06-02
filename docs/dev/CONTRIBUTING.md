# RAILWISE Desktop 开发指南

默认分支是 `dev`。本仓库测试不能从根目录运行，请进入对应 package 后执行。

## 开发环境

```bash
bun install
cd packages/desktop
bun run dev
```

桌面端壳使用 Tauri 2，前端使用 SolidJS 和 Vite。浏览器 harness 可直接启动当前源码进行 E2E 验收。

## 常用命令

```bash
cd packages/app && bun run typecheck
cd packages/desktop && bun run typecheck
cd packages/desktop && bun run build
cd packages/desktop && bun run test:e2e
```

M7 验收和发版节奏见 `docs/dev/06-m7-acceptance.md` 与 `docs/dev/05-release-cadence.md`。

## 代码规范

优先沿用现有模块结构。变量和函数名保持简洁，避免无意义抽象。新增 UI 必须提供稳定的 `data-testid`，便于 Playwright 验收。

## PR 要求

每个开发文档小节独立提交或独立 PR。PR 标题使用 `[M{N}]` 前缀，并附上验收命令输出。
