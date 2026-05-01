# 发版节奏

RAILWISE 发版按产品线拆分。Core、CLI、Desktop 可以共享底层代码，但不共享用户承诺和阻断项。

产品边界见 [00-product-boundaries.md](./00-product-boundaries.md)。

## Core

Core 不单独面向终端用户发版。它通过 CLI 包、Desktop sidecar 和 JavaScript SDK 进入产品。

Core 变更必须说明兼容性：

- HTTP/SSE API 是否兼容
- SDK 类型是否重新生成
- Agent/workflow/delivery package 契约是否变更
- 数据库或本地文件格式是否迁移

共同前置门禁见 [../admin/08-core-compatibility-gate.md](../admin/08-core-compatibility-gate.md)。

## CLI

RAILWISE CLI 按 npm/binary 包节奏发布，验收重点是命令、脚本化、CI 和无头运行。

CLI 发布不得被 Desktop 签名、公证、安装器或自动更新阻塞。

CLI 发布 runbook 见 [../admin/07-cli-release-runbook.md](../admin/07-cli-release-runbook.md)。

CLI 发布前检查：

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000
cd packages/sdk/js && bun run typecheck
```

## Desktop

RAILWISE Desktop 使用 `desktop/v{major}.{minor}.{patch}` 标签发布，版本号与桌面包、Tauri 配置和更新服务器 manifest 保持一致。

### RC1

RC1 进入 5 天内测，覆盖 10 名工程师或 PM 的真实项目样本，并完整运行 M7 的 12 条 E2E 用例。

P0 包含崩溃、数据丢失、签名失败、公证失败和更新失败，必须当日修复。P1 包含功能缺失和严重 UI 异常，修复后并入 RC2。P2 体验优化进入下一迭代 backlog。

### RC2

RC2 在 P0/P1 清零后发布，验证期 3 天。回归范围必须包含崩溃恢复、自动更新、视觉回归、TTFUI、CSV 导入、Agent Studio、工作流流水线和 PPT 生成。

### GA

GA 发布版本为 `desktop/v1.3.0` 起步。更新服务器按 10%、30%、100% 灰度推进，每阶段间隔 24 小时。GitHub Release 需要附 changelog，内网分发由管理员通过私有更新服务器推送。

### GitHub Actions 发布

桌面正式包由 `Desktop Release` workflow 生成。管理员可以通过 `workflow_dispatch` 手动输入版本号，也可以推送 `desktop/v*` 标签触发。

首次 GA 推荐使用手动触发：

```bash
gh workflow run "Desktop Release" --repo railwise-cn/RAILWISE-CLI --ref dev -f version=1.3.0
```

触发前必须完成发布 secrets 配置。完整清单和配置命令见 `docs/admin/06-desktop-release-runbook.md`。

触发前可用本地门禁确认 GitHub secret 名称已配置：

```bash
bun run desktop:release-secrets
```

### Desktop 发布前检查

```bash
cd workers/update-server && bun ./verify.ts
cd packages/app && bun run typecheck
cd packages/ui && bun run typecheck
cd packages/desktop && bun run build
cd packages/desktop && bun run check:tauri
cd packages/desktop && bun run test:tauri
cd packages/desktop && bun run smoke:tauri
bun run script/verify-desktop-native-surfaces.ts
cd packages/desktop && bun run test:e2e
```

发布前还必须执行品牌残留扫描，确保当前 UI、桌面壳和交付文档不再出现历史命名残留。

仓库根目录的总体验收入口会串联品牌残留扫描、M6 发布配置、M7 内测验收、更新分发服务验收和各 package typecheck：

```bash
bun run desktop:verify
```

GA 前置检查会额外校验版本一致性、发版文档、更新服务配置和 changelog：

```bash
bun run desktop:verify:ga
```

正式发版前执行完整 live gate：

```bash
bun run desktop:verify:ga -- --full
```

`--full` 会包含原生 Tauri smoke、30 分钟 SSE 长连和 Desktop E2E；本地浏览器预览不能替代这一门槛。

### Desktop 发布阻断项

以下任一项失败时不得进入 GA：

- `Desktop Release` workflow 在 `Validate release secrets` 步骤提示缺少 secret。
- macOS codesign 或 notarization 失败。
- Windows SignPath 签名失败。
- draft Release 缺少 Windows、macOS 或 Linux 任一平台产物。
- 更新服务器 manifest 未包含新版本签名和下载地址。

## 发布纪律

- Desktop GA 只被 Desktop blockers 阻断。
- CLI 新命令不阻断 Desktop GA，除非 Desktop 主流程依赖该命令。
- Core 契约破坏会同时阻断 CLI 和 Desktop。
- PR 描述必须声明影响的产品线和对应验证命令。
