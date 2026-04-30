# CLI 产品边界审查

**日期**: 2026-04-30
**范围**: `packages/railwise/src/cli` / `packages/railwise/test/cli` / `packages/railwise/package.json`
**状态**: P2 CLI dependency audit completed

---

## 1. 结论

RAILWISE CLI 当前没有依赖 Desktop 路径、Tauri 配置、安装器、签名、公证或桌面更新器配置。

CLI 命令保持在自己的产品边界内：

- `serve`: 启动 headless Core server。
- `web`: 启动 Core server 并打开浏览器预览。
- `upgrade`: 更新 CLI 安装本身，不触碰 Desktop release / updater。
- `export`: 导出会话 JSON，不触碰 Desktop 交付包 UI。
- `run`: 通过 Core server、SDK、工具和权限系统执行无头任务。

`packages/railwise` 可以被 Desktop 作为 sidecar 复用，但 CLI 命令不能反向引用 `packages/desktop`、Desktop 配置或 Desktop 发布流程。

---

## 2. 扫描结果

CLI 目录扫描：

```bash
rg -n "desktop|Desktop|packages/desktop|src-tauri|tauri|notarization|notarize|codesign|signing|installer|updater|update server|release artifact|app shell|dashboard|workspace" packages/railwise/src/cli packages/railwise/test/cli packages/railwise/script packages/railwise/bin
```

结果只有一处通用 LSP 命中：

```text
packages/railwise/src/cli/cmd/debug/lsp.ts: search workspace symbols
```

这是语言服务器的 workspace symbol 术语，不是 Desktop workspace 产品能力。

导入扫描：

```bash
rg -n "from ['\"](@railwise/app|@railwise/ui|@railwise/desktop|.*desktop|.*src-tauri|@tauri|tauri)['\"]|import\\(.*(@railwise/app|desktop|tauri)" packages/railwise/src/cli packages/railwise/src packages/railwise/test/cli
```

无命中。

环境和配置扫描：

```bash
rg -n "RAILWISE_CLIENT|RAILWISE_DESKTOP|TAURI|DESKTOP|desktop" packages/railwise/src/cli packages/railwise/src/flag packages/railwise/src/config packages/railwise/src/installation.ts
```

结果仅包含 `RAILWISE_CLIENT` 的 CLI/ACP 客户端标识，不包含 Desktop-only 配置。

---

## 3. 边界规则

允许 CLI 使用：

- Core session、agent、tool、server、provider、permission、SDK 契约。
- Headless server 和浏览器预览入口。
- CLI 自身安装、升级和配置。
- 机器可读输出和 CI 友好的错误码。

禁止 CLI 使用：

- `packages/desktop` 代码路径。
- `packages/desktop/src-tauri` 配置。
- Tauri updater、签名、公证、安装包流程。
- Desktop dashboard / workspace / Agent Studio 的产品承诺。
- 只能在 Desktop 原生壳中成立的本地文件、窗口、菜单或更新体验。

---

## 4. 后续

CLI 的下一步不是接入 Desktop 交付包 UI，而是单独设计 headless export/run 能力：

- `railwise workflow export` 或等价命令。
- JSON 输出和非零退出码。
- 不引入 Desktop-only 依赖。
- 验收放在 `packages/railwise` 的 CLI 测试中。
