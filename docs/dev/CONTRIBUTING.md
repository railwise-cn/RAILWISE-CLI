# RAILWISE-CLI 开发指南

默认分支是 `dev`。本仓库测试不能从根目录运行，请进入对应 package 后执行。

## 开发环境

```bash
bun install
bun run dev
```

CLI/Core 入口位于 `packages/railwise`，生成的 JavaScript SDK 位于 `packages/sdk/js`。WorkWise 是独立维护的客户端产品；本仓库中的遗留 `packages/app` 不属于 CLI 的开发、验证和发布范围。

## 常用命令

```bash
bun run rebrand:audit
bun --cwd packages/railwise typecheck
bun --cwd packages/railwise test
bun --cwd packages/sdk/js typecheck
```

客户端源码、界面 E2E、安装包和客户端发布由 WorkWise 仓库维护，不作为 RAILWISE-CLI 的合并门禁。

## 代码规范

优先沿用现有模块结构。变量和函数名保持简洁，避免无意义抽象。Core API 或 SDK 契约变更必须重新生成 SDK，并验证向后兼容性。

## PR 要求

每个开发文档小节独立提交或独立 PR。PR 标题使用 conventional commit 风格，并附上验收命令输出。
