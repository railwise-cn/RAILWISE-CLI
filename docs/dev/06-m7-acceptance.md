# M7 验收记录

验收日期：2026-04-26
最近更新：2026-06-06

## 结果

| 项目            | 结果 | 说明                                                                                                        |
| --------------- | ---- | ----------------------------------------------------------------------------------------------------------- |
| 12 条核心 E2E   | ✅   | `packages/desktop` 下 Playwright 覆盖文档要求的 12 条核心用例，并额外覆盖设置页                             |
| 视觉回归        | ✅   | `11-visual-regression.spec.ts` 验证旧版复杂首页不再出现，默认进入极简工作台                         |
| TTFUI < 15s     | ✅   | 已包含在 `12-ttfui.spec.ts`；当前内测预算以 sidecar 就绪和工作台可交互为准                                   |
| 桌面构建        | ✅   | `cd packages/desktop && bun run build` 通过                                                                 |
| Rust 检查       | ✅   | `cd packages/desktop/src-tauri && cargo check` 通过，仅保留既有 dead code warning                           |
| app typecheck   | ✅   | `cd packages/app && bun run typecheck` 通过                                                                 |
| ui typecheck    | ✅   | `cd packages/ui && bun run typecheck` 通过                                                                  |
| macOS Bundle 验证 | ✅ | `cd packages/desktop && bun run verify:local-beta` 已验证本地 `.app.zip`、主程序、sidecar、旧配置兼容和 codesign；沙箱环境只把这项作为 bundle 证据 |
| macOS 启动烟测（真实） | 待验收 | 需在普通 macOS Terminal 或 Finder 执行 `cd packages/desktop && bun run verify:local-beta:terminal`；底层 `bun run smoke:macos -- --ready-timeout 90` 会等待日志中的 `CLI health check OK`；当前 Codex shell 在 bundle 验证通过后调用 `open -n` 返回 `kLSNoExecutableErr`，不能作为真实启动通过证据 |
| sidecar 旧配置兼容 | ✅ | `cd packages/desktop && bun run verify:sidecar-config` 会用隔离目录验证 `version/system` 元数据和数组型 `tools` 不再导致启动配置错误 |
| SSE 耐久脚本    | ✅   | `cd packages/desktop && bun run test:sse -- --minutes 30` 可执行 30 分钟长连验收；本机已用 `--seconds` 烟测 |
| M7 静态验收脚本 | ✅   | `bun run script/verify-desktop-m7.ts` 检查 E2E 清单、视觉回归、TTFUI、遥测隐私和文档交付                    |
| 总体验收脚本    | ✅   | `bun run desktop:verify` 执行静态快检，`--live` 串联 SSE 烟测、E2E 监听预检和 E2E，`--full` 执行 30 分钟长连              |
| diff 空白检查   | ✅   | `git diff --check` 通过                                                                                     |
| 旧品牌残留扫描  | ✅   | 当前 UI、桌面壳、交付文档目录无旧工作台命名命中                                                             |

## M7 交付

- Playwright E2E 覆盖启动、CSV 导入、首检报告、能力市场、能力配置、工作流流水线、DXF、PPT、离线模式、更新流程、崩溃恢复、视觉回归、TTFUI 和设置入口。
- `/marketplace` 保持为简洁能力市场；`/agents` 承载能力配置、模型路由、工作流和工具/专业流程清单。
- 能力配置里的工作流预设导入会创建真实会话，并写入 chief_manager 调度消息；卡片上的 7 天调用次数来自本地 message 表。
- 埋点默认关闭，首次启动弹窗请求授权；关闭时清空本地事件队列。
- 埋点本地队列落在 `sqlite:railwise.telemetry.db`，通过 Tauri SQL plugin 写入 `telemetry_events` 和 `telemetry_state`。
- 崩溃上报通过 `RAILWISE_SENTRY_DSN` / Glitchtip DSN 启用；默认空值不上报。
- 桌面端不再暴露旧版复杂首页，默认进入 `/home`；旧 `/dashboard` 路由重定向到极简工作台。
- `packages/desktop/scripts/sse-soak.ts` 将 `/event` 长连验收固化为命令，默认 30 分钟，支持 `--seconds`、`--minutes`、`--url` 和 `--heartbeat-timeout-ms`。
- `packages/desktop/scripts/smoke-macos-app.ts` 将 macOS app 启动验收固化为命令：先验证 bundle、plist、架构和 codesign，再启动 app，并在普通 macOS 终端等待日志中的 `CLI health check OK`。
- `packages/desktop/scripts/preflight-playwright.ts` 将 E2E 本地监听权限预检固化为命令，能提前区分端口占用和沙箱 `EPERM`。
- `packages/desktop/scripts/verify-sidecar-legacy-config.ts` 将旧桌面配置兼容验收固化为命令，并已接入 macOS bundle 验证。
- `scripts/verify-desktop-m7.ts` 将 M7 静态验收固化为命令，覆盖 E2E 清单、市场/高级管理拆分、视觉回归、TTFUI、遥测隐私和文档交付。
- `scripts/verify-desktop-acceptance.ts` 提供一条命令的 M7 回归验收，默认快检，`--full` 执行 30 分钟 SSE 长连。
