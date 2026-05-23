# 架构概览

RAILWISE 采用“底层统一，产品分开”的架构。Core 是共享能力层，CLI 和 Desktop 是两个不同产品。

完整产品边界见 [00-product-boundaries.md](./00-product-boundaries.md)。

## 产品分层

```text
RAILWISE Core
  ├─ Agent v2 / workflow / delivery package
  ├─ Norm wiki / railway survey tools
  ├─ Session / provider / permission / MCP
  ├─ HTTP API / SSE event stream
  └─ JavaScript SDK contracts

RAILWISE CLI
  ├─ terminal commands
  ├─ CI and script automation
  ├─ headless workflow execution
  └─ developer diagnostics

RAILWISE Desktop
  ├─ Tauri native shell
  ├─ Codex-style Harness workbench
  ├─ capability marketplace
  ├─ project-folder chat sessions
  ├─ delivery package review/export
  └─ signing / notarization / updater
```

## Desktop 运行时三层

Desktop 自身由三层组成：

```text
Tauri 桌面壳
  ├─ 窗口、菜单、更新、系统集成
  ├─ Rust 本地命令：CAD / Office / CLI / sidecar
  └─ 本地日志、配置和 crash guard

SolidJS 前端
  ├─ /agents Harness 工作台
  ├─ 能力市场：Agents / Tools / Skills / Workflows / MCP / Providers
  ├─ 项目文件夹会话入口
  └─ 会话、权限、工具时间线、设置

Railwise Core sidecar
  ├─ HTTP API
  ├─ SSE 事件流
  ├─ Harness / Marketplace API
  └─ 多智能体会话、权限和工具调用
```

## 关键路径

- 启动：Tauri 启动 sidecar，前端等待初始化完成后进入 `/agents`。
- 项目上下文：用户选择或输入项目文件夹，Harness 把该目录作为会话工作上下文。
- 智能体任务：前端把任务交给项目总控或专业智能体，sidecar 通过 SSE 推送状态和消息。
- 能力市场：Marketplace API 管理 Agents、Tools、Skills、Workflows、MCP、Providers 和 Harness Profiles 的启用状态。
- Harness：会话页展示运行时状态、模型路由、权限决策、工具事件和交付产物时间线。
- 更新：Tauri updater 查询 `updates.railwise.cn` 或私有更新源，前端显示自定义更新弹窗。
- 埋点：默认关闭；开启后先写入本地队列，批量上报前执行脱敏。

## 边界纪律

- Core 不反向依赖 CLI 或 Desktop。
- CLI 不引入 Desktop-only 依赖，不承诺桌面安装体验。
- Desktop 不要求用户知道 CLI 命令，CLI sidecar 只是实现细节。
- `packages/app` 是共享 UI shell，Desktop 专属业务页面和文案归 `packages/desktop`。
- PR 必须能标注到 `core`、`cli`、`desktop`、`app` 或 `docs`。

Desktop v2 实施要求见 `/Users/WANGJIAWEI/CODE/RAILWISE-Desktop/RAILWISE-Desktop-开发实施文档-v2.0.md`。
