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

### 待办（M1 范围内）

- §3.4 菜单中文化（新增 `i18n/zh-CN.json` / `zh-CN.ts`）
- §3.5 加载界面（`loading.tsx`）配色与文案
- §3.6 关于对话框文案
- §3.7 启动流程 / sidecar 端口动态协商验证
- §3.8 Windows SSE 强制使用 `@tauri-apps/plugin-http` fetch
- 设计团队提供 `assets/railwise-logo-1024.png` 后重新生成全套图标资源

---

## [1.2.8] — 2026-04-15

历史版本，详见 git log。
