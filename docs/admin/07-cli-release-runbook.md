# CLI Release Runbook

本文档用于发布 RAILWISE CLI。CLI 发布只覆盖命令行包、平台二进制、GitHub Release 和 Homebrew tap，不覆盖 Desktop 安装器、签名、公证、更新服务器或桌面 GA 验收。

## 范围

包含：

- `railwise-ai` npm 包。
- `railwise-*` 平台二进制包。
- `vX.Y.Z` GitHub Release。
- Homebrew formula 更新。
- CLI 安装、升级和回滚说明。

不包含：

- Desktop `desktop/vX.Y.Z` 标签。
- Tauri updater 签名。
- macOS notarization。
- Windows SignPath 签名。
- Desktop 安装包和更新服务器 manifest。

## 前置权限

执行人需要具备：

- GitHub 仓库 `Actions: write` 与 `Contents: write`。
- npm `railwise-ai` 与 `railwise-*` 平台包 Trusted Publishing 权限。
- 如需更新 Homebrew tap，配置 `HOMEBREW_TAP_TOKEN`。

## 发布前检查

先确认分支基于 `dev`，并且本次发布没有把 Desktop-only 承诺混入 CLI 文档或命令。

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000
cd packages/sdk/js && bun run typecheck
rg -n "Desktop|workspace|Agent Studio|installer|updater|notarization|codesign" docs/user README.md
```

最后一条命中必须是产品边界说明，不能是 CLI 功能承诺。

如果本次变更影响 HTTP/SSE API、SDK 类型、Agent workflow、delivery package 或本地文件格式，先执行 Core compatibility gate，见 [08-core-compatibility-gate.md](./08-core-compatibility-gate.md)。

如果 SDK 契约改变，重新生成 JavaScript SDK：

```bash
./packages/sdk/js/script/build.ts
cd packages/sdk/js && bun run typecheck
```

## 触发发布

CLI 发布由 `publish` workflow 执行。正式版本使用 `workflow_dispatch` 触发：

```bash
gh workflow run publish --repo railwise-cn/RAILWISE-CLI --ref dev -f bump=patch
```

也可以显式指定版本：

```bash
gh workflow run publish --repo railwise-cn/RAILWISE-CLI --ref dev -f version=1.2.9
```

workflow 会执行：

1. 按平台运行 `packages/railwise/script/build.ts --single` 构建二进制。
2. 下载所有平台产物。
3. 打包 SDK/shared package tarballs 和 Agent Pack tarball 到 GitHub Release 资产。
4. 运行 `packages/railwise/script/publish.ts` 发布 `railwise-ai` 与 `railwise-*` 平台 npm 包。
5. 对正式版本创建 `vX.Y.Z` GitHub Release。
6. 在 token 存在时更新 Homebrew tap。

## 验收发布

workflow 成功后检查 npm、GitHub Release 和安装入口：

```bash
npm view railwise-ai version
gh release view v1.2.9 --repo railwise-cn/RAILWISE-CLI --json tagName,assets,url
npm install -g railwise-ai@latest
railwise --version
```

GitHub Release 必须包含 Linux、macOS 和 Windows CLI 二进制归档、Agent Pack tarball、SDK/shared package tarballs 和 `manifest.json`。npm 包必须能安装并解析到 `railwise` 命令。

普通用户的 npm 安装入口只有 `railwise-ai`。`railwise-*` 平台包是 `railwise-ai` 的 optional dependencies，SDK/shared packages 和 Agent Pack 不在常规 CLI 发布中单独 npm publish。

## 回滚

CLI 回滚不触碰 Desktop release、Desktop updater 或 `desktop/v*` 标签。

如果 npm 包发布错误：

1. 在 npm 上 deprecate 受影响版本，说明推荐版本。
2. 发布补丁版本。
3. 如 GitHub Release 产物错误，创建新的 `vX.Y.Z` 补丁 Release。
4. 如果 Homebrew tap 已更新，推送补丁 formula 或回退到上一个稳定 CLI 版本。

## 发布阻断项

以下任一项失败时不得发布 CLI：

- `packages/railwise` typecheck 或 CLI 测试失败。
- SDK typecheck 失败。
- Core compatibility gate 判定存在破坏性变更且未给出迁移方案。
- `publish` workflow 的 npm Trusted Publishing 或 CLI package 权限失败。
- 平台二进制产物缺失。
