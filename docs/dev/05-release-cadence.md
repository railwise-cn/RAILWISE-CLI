# 发版节奏

RAILWISE 现在按产物连接三条发布面：

- CLI/Core：本仓库发布 `railwise-ai` npm 包、平台二进制 npm 包、CLI 二进制和 SDK/shared release tarball。
- Agent Pack：随 CLI GitHub Release 发布 agent、skill、command 和 tool 资产包。
- Desktop：独立 `railwise-desktop-app` 仓库发布 Tauri 安装包，并通过 `.cli-version` 锁定 CLI sidecar 版本。

## CLI/Core

CLI 发版前置检查：

```bash
bun run rebrand:audit
bun run typecheck
cd packages/railwise && bun test
```

SDK 由 CLI API 生成；CLI 版本发布时同步打包对应版本的 SDK tarball。共享前端包通过本仓库的 shared package 打包脚本输出给 Desktop 消费：

```bash
bun run pack:shared
```

普通用户的 npm 安装入口只有 `railwise-ai`。`railwise-*` 平台包是 `railwise-ai` 的内部 optional dependencies；SDK、shared packages 和 Agent Pack 作为 GitHub Release 资产分发，不在常规 CLI 发布中单独 npm publish。

## Desktop

Desktop 不再从本仓库构建。Desktop 发版、签名、公证、安装器、Playwright E2E、macOS smoke、视觉回归和 updater live gate 均在 `railwise-desktop-app` 仓库执行。

升级 Desktop 所绑定的 CLI 版本时，更新 Desktop 仓库的 `.cli-version`，同步拉取对应 CLI Release 的 SDK/shared package tarballs，并在 Desktop 仓库跑完整回归。
