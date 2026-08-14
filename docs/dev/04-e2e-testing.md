# E2E 测试

Desktop E2E 已迁到独立 `railwise-desktop-app` 仓库执行；本仓库不再包含 `packages/desktop`。

CLI 仓库当前只保留 Core、CLI、SDK、共享 App Shell 和 Web 文档相关验证：

```bash
bun run typecheck
bun run rebrand:audit
```

包级测试必须进入对应 package 后运行，不能从仓库根目录运行：

```bash
cd packages/railwise
bun test

cd ../app
bun test
```

Desktop 的 Playwright、Tauri build、macOS smoke、SSE soak、视觉回归和 updater 端到端验收都在 `railwise-desktop-app` 仓库维护。
