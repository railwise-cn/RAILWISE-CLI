# RAILWISE-CLI 产品边界

- 文档版本: v3.0
- 更新日期: 2026-08-14
- 执行仓库: `railwise-cn/RAILWISE-CLI`
- 默认分支: `dev`

## 1. 现行决策

RAILWISE-CLI 只维护 Core、CLI、JavaScript SDK、Agent Pack、自动化和 CLI 发布链路。

WorkWise 是 RAILWISE 的客户端产品，独立负责界面、桌面壳、客户端 E2E、安装包和客户端发布。原先关于 `RAILWISE Desktop`、`railwise-desktop-app` 或共享 App Shell 作为客户端交付面的约定已被本决策取代。

`packages/app` 暂时作为遗留代码保留，但不属于 RAILWISE-CLI 的活跃产品范围，不参与上游同步、必需 CI 或 CLI 发布验收。删除或迁移该目录应另行实施，不能与 Core/CLI 上游同步混在一个变更中。

## 2. 维护范围

### Core

- 主目录: `packages/railwise`
- 智能体、会话、Provider、MCP、配置、数据库和权限
- HTTP API、SSE 事件流和工具执行
- Railwise 专属 memory、scheduler、marketplace 和 Agent Pack 能力

### CLI

- 主目录: `packages/railwise/src/cli`
- 命令行与 TUI
- 无头运行、脚本和 CI 集成
- 跨平台二进制、npm 包、安装脚本和升级流程

### SDK

- 主目录: `packages/sdk/js`
- Core API 的生成客户端和公开类型
- Core API 变化后运行 `./packages/sdk/js/script/build.ts` 重新生成

### 基础设施

- Core/CLI/SDK 测试与 typecheck
- 上游变更审计台账
- npm 和 GitHub Release 发布
- CLI 安装及 `railwise --version` 冒烟验证

## 3. 不在范围内

- `packages/app` 的功能开发和测试
- OpenCode App、Web 或 Desktop 代码移植
- 客户端界面、视觉回归和 Playwright E2E
- Tauri/Electron 壳、签名、公证、安装器和客户端自动更新
- WorkWise 的功能、CI 和发布

这些事项由 WorkWise 仓库独立决策。RAILWISE-CLI 只在 Core API 或 SDK 契约发生变化时提供清晰的兼容性说明，不在本仓库验证客户端实现。

## 4. 上游同步边界

OpenCode 稳定 Tag 是审计输入，不是直接合并源。每个稳定版本按以下范围评审：

- Core、CLI、TUI、Provider、MCP、Session、配置、数据库和事件流: 评审后选择性移植。
- SDK: 在 Core API 稳定后重新生成，不直接覆盖 Railwise 生成结果。
- App、Web、Desktop: 标记为 `not_applicable`。
- OpenCode 自有品牌、发布、统计和仓库自动化: 标记为 `not_applicable`。

每条上游发布说明和选中提交必须记录为 `ported`、`deferred` 或 `not_applicable`。版本号不能代替同步台账。

## 5. CI 与合并门禁

必需检查仅覆盖：

```bash
bun --cwd packages/railwise test
bun --cwd packages/railwise typecheck
bun --cwd packages/sdk/js typecheck
```

测试不能从仓库根目录运行。`test (linux)` 是受保护分支的汇总检查名，只汇总 Core/CLI 测试，不依赖客户端 E2E。

涉及 Core API 或 SDK 的变更还必须执行：

```bash
./packages/sdk/js/script/build.ts
git diff --exit-code -- packages/sdk/js
```

生成结果应随变更提交；若无差异，也应在 PR 验证记录中说明。

## 6. PR 与发布规则

PR 产品线只使用：

- `core`
- `cli`
- `sdk`
- `docs`
- `ci/release`

CLI 从 `dev` 验证，通过后提升到 `main` 并发布 npm 和 GitHub Release。WorkWise 是否升级到新 CLI/SDK 版本由 WorkWise 自己的兼容性验证决定，不阻塞 CLI 发布。

## 7. 验收标准

- `packages/railwise` 测试和 typecheck 通过。
- `packages/sdk/js` typecheck 通过，生成结果完整。
- 所有 CLI 目标平台构建成功。
- npm 安装、GitHub Release 安装和 `railwise --version` 冒烟通过。
- 现有 `.railwise/railwise.json`、记忆数据库、历史 Session、Agent Pack 和 Provider 凭据保持兼容。
- GitHub Actions 不再因遗留 App/Desktop 或无效定时任务产生红灯。
