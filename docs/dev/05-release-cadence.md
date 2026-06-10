# 发版节奏

RAILWISE 现在按产物连接三条发布面：

- CLI/Core：本仓库发布 npm 包、SDK、共享前端包和 CLI 二进制。
- Agent Pack：独立资产包发布 agent、skill、command 和 tool 资产。
- Desktop：独立 `railwise-desktop-app` 仓库发布 Tauri 安装包，并通过 `.cli-version` 锁定 CLI sidecar 版本。

## CLI/Core

CLI 发版前置检查：

```bash
bun run rebrand:audit
bun run typecheck
cd packages/railwise && bun test
```

SDK 由 CLI API 生成；CLI 版本发布时同步生成并发布对应版本的 `@railwise/sdk`。共享前端包通过本仓库的 shared package 发布脚本输出给 Desktop 消费：

```bash
bun run pack:shared
bun run publish:shared
```

## Desktop

Desktop 不再从本仓库构建。Desktop 发版、签名、公证、安装器、Playwright E2E、macOS smoke、视觉回归和 updater live gate 均在 `railwise-desktop-app` 仓库执行。

升级 Desktop 所绑定的 CLI 版本时，更新 Desktop 仓库的 `.cli-version`，同步更新 `@railwise/sdk` / shared package 版本，并在 Desktop 仓库跑完整回归。
