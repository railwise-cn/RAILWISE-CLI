# M7 验收记录

M7 Desktop 验收记录已随 Desktop 源码迁入独立 `railwise-desktop-app` 仓库。本仓库不再提供 `packages/desktop`、`desktop:verify`、`script/verify-desktop-*` 或 Tauri 构建入口。

本仓库保留的可执行验收：

```bash
bun run rebrand:audit
bun run typecheck
bun run script/verify-update-server
```

历史结论仍然有效：Desktop 需要覆盖启动、CSV 导入、能力市场、高级智能体管理、工作流、DXF、PPT、离线模式、更新流程、崩溃恢复、视觉回归、TTFUI 和设置入口。但这些测试的源码和运行说明现在以 `railwise-desktop-app` 为准。
