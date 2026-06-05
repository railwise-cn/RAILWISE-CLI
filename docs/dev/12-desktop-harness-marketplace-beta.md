# Desktop Harness Marketplace Beta QA

本文档用于 RAILWISE Desktop v1.3.0 Beta 发布前的人工验收和回归记录。目标不是证明页面能打开，而是证明桌面端已经像一个可用的本地 AI 工作台：用户进入工作台、打开项目文件夹、通过对话发起任务，并能看到执行中心、权限和能力市场的真实状态。

## 发布范围

- macOS Apple Silicon：公开 Beta DMG。
- macOS Intel：公开 Beta DMG。
- Windows x64：仅内部测试安装包，未购买 Windows 代码签名证书前不进入公开 Release。
- Linux：不做 Desktop 安装包，不做 Desktop QA；Linux 仅保留 CLI。

## 前置条件

- 使用当前分支最新构建产物或本地 `bun run dev:desktop`。
- 本地至少准备一个测试目录，目录内包含 CSV、DXF、PPTX 或测量资料样例。
- 至少配置一个模型 Provider。默认建议 DeepSeek；如果未配置模型，必须能看到明确的接入引导。
- 如果执行完整发布验收，需已准备 macOS 签名、公证和更新服务配置。

## 快速人工验收

1. 启动 Desktop。
2. 确认首屏是 Workbench，不是旧版复杂首页或高级智能体矩阵。
3. 确认首屏没有大面积 `0` 计数器。
4. 确认输入框无需滚动即可看到，主提示为“想让 RAILWISE 完成什么？”。
5. 点击“打开项目”，选择一个本地文件夹作为测试项目。
6. 在任务输入框输入：`检查当前目录中的测量资料，列出缺失文件。`
7. 点击开始协作。
8. 确认进入会话页面，协作面板显示 `RAILWISE`，内部仍由 `chief_manager` 处理协作路由。
9. 确认模型状态区显示当前模型是否就绪；未就绪时应显示接入模型入口。
10. 打开执行中心。
11. 确认执行中心显示工作区边界、权限队列、时间线和会话详情。
12. 确认没有等待审批时显示“当前没有等待审批的动作”，而不是空白面板。
13. 打开能力市场。
14. 确认能看到智能体、工具、流程、工作流、MCP、模型、执行中心分类。
15. 确认内置能力可见：RAILWISE 默认协作、本地文件读取、规范条文查询、水准闭合差检核、复测资料检查、DXF 图层检查、DeepSeek、本地安全模式。
16. 确认能力项展示权限摘要，例如文件读取、文件写入、网络、密钥和风险等级。
17. 回到 Workbench，再次发起一个任务，确认不会回到旧工作台。

## 视觉与体验检查

分别在两个尺寸做检查：

- Desktop：1440 x 900。
- Compact：390 x 844。

验收标准：

- 文案不重叠、不溢出按钮或卡片。
- 首屏没有旧版复杂首页。
- 首屏没有大面积空计数器。
- 输入框、项目选择和开始协作按钮在首屏可见。
- 能力市场分类和详情面板可读。
- 权限 chip 不遮挡主要操作。
- 执行中心时间线和权限队列在窄屏下仍可阅读。

## 自动验收命令

从仓库根目录执行：

```bash
bun run desktop:verify
```

本地 Apple Silicon 测试包：

```bash
cd packages/desktop
bun run build:macos:local
bun run package:dmg:local
```

正常 macOS Terminal 或 GitHub Actions 会生成 DMG；如果当前 shell 无法使用 `hdiutil`，脚本会生成并验证 `.app.zip`：

```text
packages/desktop/src-tauri/target/release/bundle/dmg/睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip
packages/desktop/src-tauri/target/release/bundle/dmg/睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip.sha256
```

从 Finder 解压这个 zip，打开 `睿威智测 RAILWISE.app`，按“快速人工验收”逐项确认。若要强制要求 DMG，在普通 macOS Terminal 执行：

```bash
cd packages/desktop
bun run package:dmg:local -- --require-dmg
```

交付测试包前，先核对 checksum：

```bash
cd packages/desktop/src-tauri/target/release/bundle/dmg
shasum -a 256 -c "睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip.sha256"
```

也可以从 `packages/desktop` 直接准备并打开本地应用：

```bash
bun run open:macos:local
```

如果当前 shell 不能调用 macOS 图形启动服务，先只做校验和解压：

```bash
bun run open:macos:local -- --skip-open
```

也可以用一个命令完成本地 Beta 包校验、解压和 bundle-only smoke，并打印普通 Terminal 的真实启动命令：

```bash
bun run verify:local-beta
```

该验收命令使用独立目录 `src-tauri/target/release/local-app-verify`，不会覆盖手动打开用的 `local-app`。

普通 macOS Terminal 中的真实启动验收使用一条命令完成，并会把最近一次结果写入 `docs/dev/13-desktop-beta-manual-check.md`：

```bash
bun run verify:local-beta:terminal
```

该启动验收命令使用独立目录 `src-tauri/target/release/local-app-terminal`，避免与其他本地验收脚本并发时互相清理。

如需单独确认打进包内的 sidecar 能兼容旧版桌面配置，可执行：

```bash
bun run verify:sidecar-config
```

GA 前置静态验收：

```bash
bun run desktop:verify:ga
```

正式发布前执行完整 live gate：

```bash
bun run desktop:verify:ga -- --full
```

如只验证相关包，可分包执行：

```bash
cd packages/railwise
bun test test/harness/schema.test.ts test/marketplace/service.test.ts test/server/harness.test.ts test/server/marketplace.test.ts --timeout 30000

cd ../app
bun test ./src/pages/marketplace/marketplace-state.test.ts
bun run typecheck

cd ../desktop
bun run typecheck
bun run preflight:e2e
bun run test:e2e -- 01-startup.spec.ts 04-capability-marketplace.spec.ts 08-offline-mode.spec.ts

cd ../..
bun run script/verify-desktop-windows-internal.ts
```

## Playwright 失败判定

如果 `bun run test:e2e` 失败，先区分失败类型：

- 页面断言失败：视为产品或测试回归，必须修复后才能发布。
- `bun run preflight:e2e` 返回 `EPERM`：当前 shell 不允许新建本地监听端口，需在普通 macOS Terminal 或 CI 重跑，或设置 `PLAYWRIGHT_BASE_URL` 指向已运行的 dev server。
- Vite 端口占用：更换 `PLAYWRIGHT_PORT` 或复用已有服务后重跑。
- `browserType.launch` 启动后浏览器立即关闭：视为本机 Playwright/浏览器启动层故障，需在另一台机器或 CI 重跑；不能把它当作页面通过证据。

CI 或另一台机器必须至少通过 `01-startup.spec.ts`、`04-capability-marketplace.spec.ts`、`08-offline-mode.spec.ts` 才能进入 Beta 发布。

## Beta 阻断条件

以下任一项出现时不得发布 Beta：

- Desktop 首屏不是 Workbench。
- 仍出现旧版复杂首页或旧品牌相关命名。
- 能力市场无法显示后端 capability manifest。
- 执行中心缺少权限队列、时间线或会话详情。
- 打开项目后不能创建会话。
- 模型未配置时没有接入引导。
- macOS app 无法启动 sidecar，且启动失败页不能打开日志目录。
- 发布矩阵出现 Linux Desktop 包。

## 记录模板

```text
版本：desktop/v1.3.0-beta.N
日期：
测试人：
机器：macOS Apple Silicon / macOS Intel / Windows x64 内测
构建来源：GitHub Actions / 本地构建
自动验收：通过 / 未通过
人工验收：通过 / 未通过
阻断问题：
备注：
```
