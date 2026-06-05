# Desktop Beta 人工验收记录

本文档用于记录 RAILWISE Desktop v1.3.0 Beta 的本地人工验收。自动验收只能证明构建、bundle、签名、sidecar 旧配置兼容、能力清单和静态回归；最终可用性必须由真实桌面启动和真实项目目录确认。

## 测试包

- 平台：macOS Apple Silicon
- 构建日期：2026-06-06
- 构建来源：本地 `packages/desktop`
- 测试包：

```text
packages/desktop/src-tauri/target/release/bundle/dmg/睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip
```

- SHA256：

```text
384ace326f5f4abe5287ca72455e721f4284ef27b6e58375dd498932036bf15e
```

- 校验命令：

```bash
cd packages/desktop/src-tauri/target/release/bundle/dmg
shasum -a 256 -c "睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip.sha256"
```

- 本机打开命令：

```bash
cd packages/desktop
bun run open:macos:local
```

- 只校验并解压：

```bash
cd packages/desktop
bun run open:macos:local -- --skip-open
```

- 本地 Beta 包总检查：

```bash
cd packages/desktop
bun run verify:local-beta
```

该命令会解压到 `src-tauri/target/release/local-app-verify`，只用于自动验收。

- 普通 macOS Terminal 一键启动验收并写入本文档：

```bash
cd packages/desktop
bun run verify:local-beta:terminal
```

该命令会解压到 `src-tauri/target/release/local-app-terminal`，避免和 `open:macos:local` 互相覆盖。

- Finder 和人工 checklist 确认后，写入门禁状态：

```bash
cd packages/desktop
bun run record:local-beta -- --finder-launch passed --manual-checklist passed --beta-decision passed
```

如果 `automatic_checks`、`terminal_smoke`、`finder_launch`、`manual_checklist` 未全部通过，脚本会拒绝把 `beta_decision` 写成 `passed`。

- 单独校验 sidecar 旧配置兼容：

```bash
cd packages/desktop
bun run verify:sidecar-config
```

## 状态

<!-- manual-acceptance-status:start -->
- automatic_checks=passed
- terminal_smoke=pending
- finder_launch=pending
- manual_checklist=pending
- beta_decision=pending
<!-- manual-acceptance-status:end -->

说明：

- `automatic_checks=passed`：静态验收和 bundle-only 验证已通过。
- `terminal_smoke=pending`：普通 macOS Terminal 真实启动烟测待验收。
- `finder_launch=pending`：Finder 双击启动待人工确认。
- `manual_checklist=pending`：下方人工验收项待逐项确认。
- `beta_decision=pending`：未达到 Beta/GA 发版条件。
- Codex shell 启动烟测：受限，`open -n` 返回 `kLSNoExecutableErr`；这不是可发布证据。

验收通过后按实际结果更新以上状态。普通 Terminal 脚本只会自动更新 `terminal_smoke`；Finder 双击、人工验收项和是否进入 Beta/GA 必须由测试人确认后手动改为 `passed`。GA 门禁会读取这个状态块，不能只保留下面模板里的“结论：通过”。

## 启动说明

Codex 沙箱或受限 shell 可能在 `open -n` 时返回 `kLSNoExecutableErr`。如果脚本输出已经显示 bundle、主程序、sidecar、旧配置兼容和 codesign 校验通过，这条 LaunchServices 报错不能直接判定为 App 缺少可执行文件；需要从 Finder 双击或在普通 macOS Terminal 执行 `bun run open:macos:local` 复核真实启动行为。

`bun run verify:local-beta:terminal` 会把最新启动日志和诊断分类写回下方记录；如果失败，优先看记录里的“诊断：配置文件需要修复 / 本地端口被占用 / 系统权限阻止启动 / 核心服务未就绪”。

本轮在 Codex shell 中执行过：

```bash
cd packages/desktop
bun run smoke:macos -- --app "src-tauri/target/release/local-app/睿威智测 RAILWISE.app" --ready-timeout 90 --skip-process-check
```

结果：bundle 15 项验证通过，随后 `open -n` 返回 `NSOSStatusErrorDomain Code=-10827 kLSNoExecutableErr`。下一步必须在普通 macOS Terminal 或 Finder 里重跑启动，不把这条受限 shell 失败当作产品闪退结论。

## 终端启动验收记录

<!-- terminal-smoke-latest:start -->
- 时间：待普通 macOS Terminal 验收
- 结果：待验收
- App：packages/desktop/src-tauri/target/release/local-app-terminal/睿威智测 RAILWISE.app
- ZIP：packages/desktop/src-tauri/target/release/bundle/dmg/睿威智测 RAILWISE_1.3.0_local_aarch64.app.zip
- 命令：`bun run verify:local-beta:terminal`
- 摘要：待运行

```text
等待普通 macOS Terminal 执行一键启动验收。
```
<!-- terminal-smoke-latest:end -->

## 人工验收项

1. 解压 `.app.zip` 后能得到 `睿威智测 RAILWISE.app`。
2. 从 Finder 双击应用可以启动，不出现 macOS 闪退。
3. 启动失败时，失败页能显示日志并能打开日志目录。
4. 首屏是极简 Workbench，不是旧版复杂首页或多智能体协作中枢。
5. 首屏主提示为“想让 RAILWISE 完成什么？”。
6. 首屏没有大面积 `0` 计数器。
7. 点击“打开项目”可以选择本地文件夹。
8. 选择项目后主界面不暴露完整本地路径，只显示项目名称或可区分的项目名。
9. 未接入模型时输入任务并点击“开始协作”，先停留在首页并打开 DeepSeek 接入引导。
10. DeepSeek 接入完成后，自动带着原任务进入会话；已接入模型时点击“开始协作”可直接进入会话。
11. 已接入模型时可以发起一次真实对话。
12. 能力市场能显示智能体、工具、流程、工作流、MCP、模型、执行中心分类。
13. 能力市场能看到 RAILWISE 默认协作、本地文件读取、规范条文查询、水准闭合差检核、复测资料检查、DXF 图层检查和 DeepSeek。
14. 执行中心能显示工作区边界、权限队列、时间线和会话详情。
15. 会话中的文件、执行证据和成果文件可以引用回输入框继续追问。
16. 应用重启后仍能回到新版 Workbench，不回到旧工作台。

## 结论记录

```text
测试人：
测试时间：
机器：
模型 Provider：
测试项目目录：
通过项：
失败项：
阻断问题：
结论：通过 / 不通过
备注：
```
