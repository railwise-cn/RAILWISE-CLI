# CLI 验证

RAILWISE-CLI 只验证 Core、CLI 和 SDK。WorkWise 已代替原客户端产品，界面 E2E、桌面构建和客户端发布均由 WorkWise 仓库负责。

本仓库的必需验证为：

```bash
bun --cwd packages/railwise test
bun --cwd packages/railwise typecheck
bun --cwd packages/sdk/js typecheck
```

包级测试不能从仓库根目录运行。`packages/app` 的 Playwright 和单元测试不参与 CLI 合并门禁；OpenCode App/Desktop 更新也不在本仓库移植。
