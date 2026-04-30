# 产品线 Backlog 拆分

**日期**: 2026-04-30
**状态**: draft PR #12 后续拆分计划
**原则**: Core 共享，CLI 和 Desktop 分别验收

---

## 1. 当前 PR 定位

PR #12 是一次混合交付包，保持 draft。它包含：

- Core: Agent v2、workflow delivery、norm wiki、survey tools、SDK contracts。
- Desktop: Dashboard、Workspace、Agent Studio、delivery package UI、release readiness。
- App shell: 共享页面和客户端契约。
- CI/release: Desktop release gates、secret checks、PR product-line checks。
- Docs: 产品边界和发版节奏。

后续不再继续把这些方向塞进同一个 PR。新增任务按以下产品线拆分。

---

## 2. Core Backlog

Core 只处理共享引擎和契约。

### C1 Workflow Delivery Contract

- 确认 delivery package manifest 的稳定字段。
- 为 `summary.md`、`manifest.json`、artifact list 写契约测试。
- 明确 delivery package 版本字段和兼容策略。
- 输出 SDK 类型更新规则。
- Delivery package 产品线边界见 [10-delivery-package-boundary-map.md](./10-delivery-package-boundary-map.md)。

验收：

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000 test/server/agent-studio.test.ts test/agent/railwise-v2.test.ts
cd packages/sdk/js && bun run typecheck
```

### C2 Agent Workflow Runtime

- 继续收敛 native workflow agents 的默认选择规则。
- 保持 `chief_manager` 显式可用，但不作为默认 fallback。
- 为 workflow handoff、acceptance、artifact archive 增加回归测试。

验收：

```bash
cd packages/railwise && bun test --timeout 30000 test/agent/agent.test.ts test/agent/railwise-v2.test.ts
```

### C3 Norm Wiki and Survey Tools

- 将 norm ingest/search/lint/diff/report 分成稳定 Core APIs。
- 将 survey adjustment tools 的输入输出样例固化到 fixture。
- 为格式转换、平差、粗差探测、自由网、方差分量估计分别保留最小可复现测试。

验收：

```bash
cd packages/railwise && bun test --timeout 30000 test/tool/wiki.test.ts test/tool/adjustment.test.ts
```

---

## 3. CLI Backlog

CLI 只处理命令行和无头自动化。它不承担 Desktop GA 的安装、签名、公证和 UI 验收。

### CL1 Workflow Delivery Export Command

- [x] 设计 `railwise workflow export` 命令。
- [x] 支持按 session id 导出 delivery package。
- [x] 输出机器可读 JSON，适合 CI 使用。
- [x] 不引入 Desktop-only 依赖。

验收：

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000 test/cli
```

### CL2 Headless Workflow Run

- [x] 支持无头启动 workflow preset。
- [x] 支持等待验收结果和非零退出码。
- [x] 支持输出 artifact 路径。

验收：

```bash
cd packages/railwise && bun test --timeout 30000 test/cli test/server
```

### CL3 CLI Documentation

- [x] README CLI quickstart 只讲安装、模型、配置、命令和 CI。
- [x] 不混入 Desktop dashboard、Workspace、installer、updater 承诺。
- [x] CLI 命令边界审查记录见 [09-cli-boundary-audit.md](./09-cli-boundary-audit.md)。

验收：

```bash
rg -n "Desktop|dashboard|workspace|installer|updater" docs/user README.md
```

命中必须是有意说明产品边界，而不是 CLI 功能承诺。

---

## 4. Desktop Backlog

Desktop 只处理可视化工作台、原生壳和安装更新。Desktop 用户不应被要求理解 CLI。

### D1 Desktop GA Blockers

这些是 Desktop GA 阻断项：

- macOS codesign 配置完成。
- macOS notarization 配置完成。
- Windows 签名配置完成。
- 更新服务器 manifest 校验通过。
- Windows/macOS/Linux release artifacts 齐全。
- Desktop E2E 通过。
- crash recovery、auto update、TTFUI、visual regression 通过。

不属于 Desktop GA blocker：

- 新增 CLI 命令。
- CLI 文档完善。
- CI-only workflow export。
- 非 Desktop 主流程依赖的 Core 实验 API。

验收：

```bash
bun run desktop:release-secrets
bun run desktop:verify:ga
bun run desktop:verify:ga -- --full
```

### D2 Desktop Delivery Package UX

- [x] Session 页面清楚展示 delivery package 状态。
- [x] Session 交付面板能审阅 summary、manifest、artifact list。
- [x] 用户能重新导出交付包。
- [x] 错误状态提供可行动的提示。

当前状态：

- App shell 的 Session 交付面板显示交付包完整性、导出时间、summary、manifest、包内文件和写入状态。
- 包内文件支持复制路径；在 Desktop 壳中可直接打开已写入文件或交付目录。
- 缺失文件会提示用户重新导出或检查源文件可读性。

验收：

```bash
cd packages/app && bun run typecheck
cd packages/app && bun run test:unit
cd packages/desktop && bun run typecheck
```

### D3 Native Desktop Acceptance

- Desktop 验收必须经过 Tauri 原生壳。
- 浏览器预览只能作为 UI iteration，不作为 GA 验收。
- 本地文件、sidecar、updater、窗口、菜单必须在原生路径里验证。

验收：

```bash
cd packages/desktop && bun run test:e2e
cd packages/desktop/src-tauri && cargo check
```

---

## 5. App Shell Backlog

App shell 是共享 UI，不是商业产品边界。

### A1 Shared UI Boundaries

- [x] 检查 `packages/app` 中是否存在 Desktop-only 文案。
- [x] 将 Desktop-only 文案移动到 `packages/desktop` 或通过 Desktop 配置注入。
- [x] 保留 browser preview 所需的通用 UI。

审查记录见 [08-app-shell-boundary-audit.md](./08-app-shell-boundary-audit.md)。

验收：

```bash
rg -n "installer|updater|notarization|codesign|Desktop GA|Tauri" packages/app/src packages/app/README.md
cd packages/app && bun run typecheck
```

命中必须是通用说明或明确可复用文案。

---

## 6. Docs and CI Backlog

### P1 Product Line Labels

- PR 模板必须勾选产品线。
- PR 合规检查必须拒绝缺少产品线的外部 PR。
- 贡献文档必须说明 mixed PR 的例外条件。

验收：

```bash
ruby -e "require 'yaml'; YAML.load_file('.github/workflows/pr-standards.yml')"
rg -n "Product line|product line|产品线" .github CONTRIBUTING.md docs/dev
```

### P2 Release Docs Split

- [x] CLI release docs 独立，见 [../admin/07-cli-release-runbook.md](../admin/07-cli-release-runbook.md)。
- [x] Desktop release runbook 只保留桌面签名、公证、更新、安装器和 GA gates。
- [x] Core compatibility notes 作为 CLI 和 Desktop 共同前置门禁，见 [../admin/08-core-compatibility-gate.md](../admin/08-core-compatibility-gate.md)。

验收：

```bash
rg -n "CLI|Desktop|Core|desktop/v|npm|notarization|codesign" docs/admin docs/dev
```

命中需要归属明确。

---

## 7. 执行顺序建议

1. 先完成 Docs and CI 的产品线门禁。
2. 再拆 Core contract 和 Desktop GA blockers。
3. Desktop GA 继续推进签名、公证、更新、E2E。
4. CLI export/headless workflow 单独排期，不阻断 Desktop GA。
5. App shell 只做共享 UI 清理，避免再次变成产品叙事中心。

---

## 8. 当前状态

- [x] 产品边界文档已建立。
- [x] PR 模板已加入产品线选择。
- [x] PR 合规检查已加入产品线选择检查。
- [x] 当前 draft PR 已更新产品线说明。
- [x] Core contract backlog 已拆为 [#13](https://github.com/railwise-cn/RAILWISE-CLI/issues/13)。
- [x] CLI export/headless backlog 已拆为 [#14](https://github.com/railwise-cn/RAILWISE-CLI/issues/14)。
- [x] `railwise workflow run/export` CLI MVP 已落地并用真实 CLI 入口 smoke 覆盖。
- [x] Desktop GA blockers 已拆为 [#15](https://github.com/railwise-cn/RAILWISE-CLI/issues/15)。
- [x] App shell 文案边界已扫描并修正。
- [x] CLI 命令边界已扫描，未发现 Desktop-only 依赖。
- [x] Delivery package Core API、Desktop/App UI、CLI export 边界已归档。
- [x] Release docs 已按 CLI、Desktop、Core compatibility 拆分。
