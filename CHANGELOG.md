# Changelog

本文件记录睿威智测 RAILWISE 项目的版本变更。版本号遵循 [Semantic Versioning](https://semver.org/lang/zh-CN/)。

---

## [Unreleased] — feat/desktop-v1.3.0-m1

### M1 基建整备（进行中）

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
- 新增 `scripts/rebrand-audit.ts` — 扫描 `opencode` / `anomalyco` / `anomaly.co` 残留字样

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

### 待办（M1 范围内）

- §3.8 Windows SSE 强制使用 `@tauri-apps/plugin-http` fetch + UI 状态指示器
- §3.9 本章交付物清单逐项检验
- 设计团队提供 `assets/railwise-logo-1024.png` 后重新生成全套图标资源
- 真实 NSIS 横幅 `nsis-header-railwise.bmp` / `nsis-sidebar-railwise.bmp` 替换

---

## [1.2.8] — 2026-04-15

历史版本，详见 git log。
