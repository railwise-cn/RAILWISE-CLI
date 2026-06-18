# Changelog

本文件记录睿威智测 RAILWISE 项目的版本变更。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## v1.2.32 — CLI + Agent Pack 同版发布

_发布日期: 2026-06-19_

- 接续 GitHub Latest `v1.2.31` 发布 CLI/Core/SDK，显式使用 `v1.2.32` 避免 npm latest 落后导致的 patch 版本回撞。
- CLI 发布 workflow 增加 `@railwise/agent-pack` 抽取、打包、npm 发布和 GitHub Release 附件上传，保持 Agent Pack 随 CLI 同版交付。
- Agent Pack 安装模板支持 `lib` 资产，并按原文件名安装 agent、command、tool、template、theme 和 lib 文件，确保 OS tools 的 `../lib/os_api` 依赖随包发布。
- 保持产品边界：本仓库只发布 CLI、SDK、shared packages 和 Agent Pack；Desktop 仍由独立 `railwise-desktop-app` 仓库发布。

---

## v1.2.31 — GitHub Latest Release 对齐

_发布日期: 2026-06-10_

- 以 GitHub `railwise-cn/RAILWISE-CLI` 的 Latest release `v1.2.31` 为当前 CLI/Core/SDK/Agent Pack 文档锁版来源。
- Workspace package metadata 从 `1.2.8` 对齐到 `1.2.31`，发布脚本仍可通过 `RAILWISE_VERSION` 在 CI 中显式覆盖构建版本。
- 继续保持产品边界：本仓库维护 Core、CLI、SDK、共享 App Shell 和 Agent Pack；Desktop 源码、Tauri 配置、安装包、签名、公证和 updater 仍归独立 `railwise-desktop-app` 仓库。

---

## v1.3.0 — Desktop 中文化首版

_发布日期: 待发布_

### 新增

- 桌面端整体品牌化为 **睿威智测 RAILWISE**（`packages/desktop/`）
- macOS 顶部菜单全量中文化：应用 / 文件 / 编辑 / 视图 / 帮助 5 个一级菜单 + 全部子项接入 `t("desktop.menu.*")`
- 启动加载窗口 3 段中文文案：读取 `.railwise` 配置中 → 数据库迁移中 → 准备就绪；奶白背景 + 暖棕强调
- RAILWISE 2.0 设计令牌落地（`packages/desktop/src/styles.css`）：`:root` 注入 28+ 变量 + Tailwind v4 `@theme` 块（`rw-` 前缀，避免与 `@railwise/ui` 既有 token 冲突）
- 系统语言自动检测，无语言时默认中文（`detectLocale()` fallback 由 `en` 改为 `zh`）
- SSE 连接状态指示器（`packages/app/src/components/ConnectionStatus.tsx`）：右下角浮动徽标，仅在重连 / 断开时显示
- `scripts/rebrand-audit.ts`：扫描旧品牌残留字样，CI 友好（exit 0/1）
- Linux AppStream metainfo（`packages/desktop/src-tauri/release/appstream.metainfo.xml`）：name / summary / description / URLs 全部品牌化为睿威智测，30 个历史 release tag URL 迁移到 `github.com/railwise-cn/RAILWISE-CLI`

### 变更

- `tauri.conf.json` / `tauri.prod.conf.json`：
  - `productName` → `睿威智测 RAILWISE Dev` / `睿威智测 RAILWISE`
  - `identifier` → `com.railwiseai.desktop.dev` / `com.railwiseai.desktop`
  - `mainBinaryName` → `railwise`（小写）
  - 图标路径 `icons/dev/*` 与 `icons/prod/*` → `icons/railwise/*`
  - NSIS 横幅 `assets/nsis-header.bmp` / `nsis-sidebar.bmp` → `*-railwise.bmp`
  - 更新通道 endpoint 指向 `github.com/railwise-cn/RAILWISE-CLI`
  - Linux deb metainfo 路径迁移到 `com.railwiseai.desktop.metainfo.xml`
- `packages/desktop/package.json`：新增 `description`，`version` 1.2.8 → 1.3.0
- `packages/desktop/src-tauri/Cargo.toml`：`name = "railwise"`、`version = "1.3.0"`、`description / authors` 改为 Railwise AI Team；`edition` 保留 `2024`（与既有工具链匹配，未按文档建议降级到 `2021`）
- `packages/desktop/src-tauri/Cargo.lock`：桌面 crate 命名统一为 `railwise`，version 同步升至 `1.3.0`（下次 `cargo build` 会重新校验）
- `packages/desktop/src/loading.tsx`：背景色锁定 `rgb(251,251,249)`，强调色 `rgba(117,86,32,0.9)`，字体 PingFang SC 优先；保留 SQLite 迁移进度条
- SSE 心跳间隔 10s → 8s（`packages/railwise/src/server/server.ts` + `routes/global.ts`），低于 WebView2 空闲断连阈值
- `global-sdk.tsx` 心跳监督超时 15s → 20s（>2× 服务端心跳，容忍单次心跳丢失而不误触发 abort）
- README 头部：`# 睿威智测 RAILWISE` + 三端简介

### 修复

- **Windows WebView2 SSE 静默断流**：`packages/app/src/context/global-sdk.tsx` 的 `eventFetch` 选择新增 `platform.os === "windows"` 短路分支，Windows 桌面端无论是否 loopback 均强制走 `@tauri-apps/plugin-http`，绕过 WebView2 网络栈
- 多开端口冲突：`get_sidecar_port()` 经 `TcpListener::bind("127.0.0.1:0")` 由 OS 分配空闲端口；前端 `ServerGate` 经 `awaitInitialization()` 动态获取 URL，无任何 8787/4096 系列硬编码

### 内部

- 新增 `CHANGELOG.md`（仓库根，本文件）
- 新增 `icons/railwise/` 目录（从 `icons/dev/` 复制为占位图标，附 `README.md` 标注待设计交付后替换）
- 新增 `assets/nsis-header-railwise.bmp` / `nsis-sidebar-railwise.bmp` 占位
- 新增 `packages/app/src/components/ConnectionStatus.tsx`
- 心跳行内注释统一引用本文档 §3.8.2

### M6 / M7 发版收口

- M6 发布配置验收固化为 `scripts/verify-desktop-release.ts`，覆盖三平台 target、签名环境、生产 Tauri 配置、更新端点、安装器资源、CLI 安装命令和更新弹窗。
- M7 内测验收固化为 `scripts/verify-desktop-m7.ts`，覆盖 12 条核心 E2E、视觉回归、TTFUI、遥测隐私和用户 / 管理员 / 开发者文档。
- 更新分发 Worker 验收固化为 `workers/update-server/verify.ts`，覆盖 204、灰度、平台过滤、国内 / 海外 CDN 和 no-store 响应。
- GA 前置验收固化为 `scripts/verify-desktop-ga.ts`，串联版本一致性、发版文档、changelog 和 `desktop:verify`。

### 已知遗留（发版前收口）

- 真实品牌图标（`assets/railwise-logo-1024.png`）与 NSIS 横幅 BMP 由设计团队交付后替换
- 运行时验证 `bun run desktop:verify:ga -- --full` 需要执行 30 分钟 SSE 长连接与完整 E2E

---

## §3.9 M1 验收清单（feat/desktop-v1.3.0-m1）

| 序号 | 交付物                     | 路径                                                                        | 验收结果                                                                                                              |
| ---- | -------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1    | 品牌替换（Desktop 范围）   | tauri.conf.json / tauri.prod.conf.json / Cargo.toml / package.json / README | ✓ 全部静态字段已替换；`bun run script/rebrand-audit.ts` 通过                                                          |
| 2    | i18n 字典（简体中文）      | `packages/desktop/src/i18n/zh.ts` + `en.ts`                                 | ✓ 文档 §3.4.1 全部 key 已添加；`bun typecheck` 通过                                                                   |
| 3    | rebrand-audit 扫描脚本     | `scripts/rebrand-audit.ts`                                                  | ✓ 脚本已创建；交付范围扫描 0 处旧品牌残留                                                                             |
| 4    | Design Tokens CSS          | `packages/desktop/src/styles.css`                                           | ✓ 文档 §3.6.1 验证脚本通过：`--bg-primary` = `rgb(251, 251, 249)`，29/28 个必备令牌齐全                               |
| 5    | Tailwind 令牌配置          | `packages/desktop/src/styles.css`（`@theme` 块）                            | ✓ Tailwind v4 `@theme` 已注入 `rw-` 前缀令牌；`bun typecheck` 无 CSS 解析错误                                         |
| 6    | SSE 客户端（Windows 修复） | `packages/app/src/context/global-sdk.tsx`                                   | ✓ `platform.os === "windows"` 强制走 `@tauri-apps/plugin-http`；250ms 自动重连；20s 心跳监督；运行时验证待 Windows VM |
| 7    | ConnectionStatus 组件      | `packages/app/src/components/ConnectionStatus.tsx`                          | ✓ 三种状态文案 + 颜色映射文档 §3.8.3；已挂载到 `AppInterface`                                                         |
| 8    | 服务端心跳间隔             | `packages/railwise/src/server/server.ts` + `routes/global.ts`               | ✓ `10_000` → `8_000` ms；仅修改 .ts 源文件                                                                            |
| 9    | CHANGELOG 新条目           | `CHANGELOG.md`                                                              | ✓ 本文件 v1.3.0 段落                                                                                                  |

---

## v1.3.0 — 详细变更日志（按文档章节顺序）

> 以下条目按 `RAILWISE-Desktop-开发实施文档-v1.0.md` §3.3 ~ §3.9 顺序记录每个 PR 的细节，作为上面 release notes 的补充。

### M1 基建整备（已完成）

#### 品牌替换（§3.3）

- `tauri.conf.json` / `tauri.prod.conf.json`：
  - `productName` → `睿威智测 RAILWISE Dev` / `睿威智测 RAILWISE`
  - `identifier` → `com.railwiseai.desktop.dev` / `com.railwiseai.desktop`
  - `mainBinaryName` → `railwise`
  - 图标路径 `icons/dev/*` 与 `icons/prod/*` → `icons/railwise/*`
  - NSIS 横幅 `assets/nsis-header.bmp` / `assets/nsis-sidebar.bmp` → `*-railwise.bmp`
  - 更新通道端点指向 `github.com/railwise-cn/RAILWISE-CLI`
  - Linux deb metainfo 路径迁移到 `com.railwiseai.desktop.metainfo.xml`
- `packages/desktop/package.json`：
  - 新增 `description: "睿威智测 Railwise AI 工程测绘多智能体系统 — 桌面端"`
  - `version` 从 `1.2.8` 升至 `1.3.0`
- `packages/desktop/src-tauri/Cargo.toml`：
  - `name = "railwise"`（原 `railwise-desktop`）
  - `version = "1.3.0"`（原 `0.0.0`）
  - `description = "睿威智测 Railwise AI 工程测绘多智能体系统"`
  - `authors = ["Railwise AI Team <dev@railwiseai.com>"]`
  - `edition` 保留为 `2024`（与既有工具链匹配，未按文档建议降级到 `2021`）
- `README.md` 头部更新为 `# 睿威智测 RAILWISE` + 副标题
- `icons/railwise/` 目录从 `icons/dev/` 复制为占位图标，`README.md` 标注待设计交付后替换
- 新增 `scripts/rebrand-audit.ts` — 扫描旧品牌残留字样

#### 菜单中文化（§3.4）

- `packages/desktop/src/i18n/en.ts` / `zh.ts`：新增 28 个 `desktop.menu.*` 键、6 个 `desktop.loading.*`、6 个 `desktop.updater.*`、3 个 `desktop.tray.*`、2 个 `desktop.about.*`、`error.dev.rootNotFound`。
- `packages/desktop/src/menu.ts`：macOS 顶部 5 个一级菜单（应用 / 文件 / 编辑 / 视图 / 帮助）全部接入 `t()`；Help 菜单 4 个外链 i18n 化；FEEDBACK_URL / BUG_URL 切换到 `github.com/railwise-cn/RAILWISE-CLI`。
- `packages/desktop/src/i18n/index.ts`：`detectLocale()` 默认 fallback 由 `"en"` 改为 `"zh"`，新增显式 `en` 分支匹配。
- 不新增 `zh-CN.ts` / `zh-CN.json` — 现仓库 i18n 体系 locale id 用 `zh`（简体）/ `zht`（繁体），扩展现有 `zh.ts` 字典更安全。

#### 加载窗口（§3.5）

- `packages/desktop/src/loading.tsx`：状态文案改用 `t("desktop.loading.*")` 三键；背景锁定奶白 `rgb(251,251,249)`、强调色暖棕 `rgba(117,86,32,0.9)`；新增中文品牌名 + 副标题；保留 SQLite 迁移进度条。

#### 设计令牌（§3.6）

- `packages/desktop/src/styles.css`：注入 §2.8 全部 28+ 设计令牌（色彩 / 字体 / 空间 / 圆角 / 阴影）；新增 `@theme` 块以 `rw-` 前缀桥接到 Tailwind v4 utility class，避免与 `@railwise/ui` 既有 token 命名冲突。

#### Sidecar 打包验证（§3.7 — 静态检查通过）

- `tauri.conf.json` 已含 `externalBin: ["sidecars/railwise-cli"]`。
- `packages/desktop/scripts/predev.ts` 已实现：通过 `RUST_TARGET` 环境变量挑选 `SIDECAR_BINARIES` 三元组，调用 `packages/railwise` 的 `bun run build --single`，再 `copyBinaryToSidecarFolder` 落到 `src-tauri/sidecars/railwise-cli-<triple>`。
- `packages/desktop/src-tauri/src/lib.rs::get_sidecar_port()` 通过 `TcpListener::bind("127.0.0.1:0")` 让 OS 分配空闲端口，端口号经 `spawn_local_server` 传入 sidecar `--port`。
- 静态扫描 `packages/desktop/src/` 与 `src-tauri/src/`：未发现 `localhost:8787` / `localhost:4096` / `127.0.0.1:8787` / `127.0.0.1:4096` 等硬编码端口。
- 前端 `packages/desktop/src/index.tsx::ServerGate` 完全使用 `commands.awaitInitialization()` 返回的 `data().url`，无任何端口硬编码。
- ⚠ 运行时验证（`bun run dev:desktop`）需要在沙盒外执行：sidecar 编译需要联网拉取 `models.dev` provider snapshot，且部分构建后处理会写 `.git/config`。

#### Windows SSE 修复（§3.8）

- `packages/app/src/context/global-sdk.tsx::eventFetch`：`platform.os === "windows"` 时直接调用 `platform.fetch`（路由到 `@tauri-apps/plugin-http`），跳过 WebView2 原生 fetch 的 loopback 长连接问题；其他 OS 仅在远程 HTTP 时强制走 plugin-http。
- `HEARTBEAT_TIMEOUT_MS` 15s → 20s，>2× 服务端心跳，避免单次心跳丢失误中止。
- 新增 `connectionStatus` Signal（`"connected" | "reconnecting" | "disconnected"`）：在 SSE 主循环每次 attempt 前置为 `reconnecting`，收到首事件后置为 `connected`，stream 抛出错误后置为 `disconnected`；通过 `useGlobalSDK()` 暴露。
- 服务端心跳：`packages/railwise/src/server/server.ts` + `packages/railwise/src/server/routes/global.ts` 心跳间隔 `10_000` → `8_000` ms。
- 新增 `packages/app/src/components/ConnectionStatus.tsx`：右下角浮动徽标，仅在 `reconnecting` / `disconnected` 时显示（黄色脉冲 / 红色圆点），背景奶白半透明 + `--shadow-sm`，角色 `role="status" aria-live="polite"`。
- 挂载点：`packages/app/src/app.tsx` 的 `GlobalSyncProvider` 内、`Router` 外，跨路由常驻。

#### M1 验收清单（§3.9，已完成）

- Desktop 范围品牌字段全替换 ✓
- i18n 字典齐全 + `bun typecheck` 通过 ✓
- `rebrand-audit.ts` 在 `packages/desktop` 内零残留 ✓
- 设计令牌 28+ 项 + Tailwind `@theme` 注入 ✓
- SSE 客户端 Windows 修复 + 心跳监督 + ConnectionStatus 组件 ✓
- 服务端心跳 8s ✓
- CHANGELOG 本条目 ✓
- `appstream.metainfo.xml` 全部品牌化（含 30 个历史 release tag URL）✓
- `Cargo.lock` 中桌面 crate 命名统一为 `railwise@1.3.0` ✓

### 待办（移交给设计团队 / 发版前 live gate）

- 设计团队提供 `assets/railwise-logo-1024.png` 后重新生成全套图标资源（M7 范围）
- 真实 NSIS 横幅 `nsis-header-railwise.bmp` / `nsis-sidebar-railwise.bmp` 替换（M7 范围）
- 运行时验证 `bun run desktop:verify:ga -- --full`：30 分钟 SSE 长连接与完整 E2E

---

## [1.2.8] — 2026-04-15

历史版本，详见 git log。
