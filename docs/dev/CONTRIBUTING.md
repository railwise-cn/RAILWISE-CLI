# RAILWISE-CLI 开发指南

默认分支是 `dev`。本仓库测试不能从根目录运行，请进入对应 package 后执行。

## 开发环境

```bash
bun install
bun run dev
```

CLI/Core 入口位于 `packages/railwise`。共享 Web App Shell 位于 `packages/app`，给浏览器预览和独立 Desktop 仓库消费。

## 常用命令

```bash
bun run rebrand:audit
bun run typecheck
cd packages/railwise && bun test
cd packages/app && bun run typecheck
```

Desktop 源码、Tauri build、Playwright E2E、签名、公证和安装包发版在独立 `railwise-desktop-app` 仓库维护。

## 代码规范

优先沿用现有模块结构。变量和函数名保持简洁，避免无意义抽象。新增 UI 必须提供稳定的 `data-testid`，便于 App Shell 和 Desktop 消费方验收。

## PR 要求

每个开发文档小节独立提交或独立 PR。PR 标题使用 conventional commit 风格，并附上验收命令输出。
