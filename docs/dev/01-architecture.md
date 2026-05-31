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
  ├─ Agent Studio collaboration hub
  ├─ workspace file preview
  ├─ workflow orchestration
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
  ├─ /agents 智能体协作中枢
  ├─ /workspace 数据与成果工作台
  └─ 会话、模板、Prompt 队列、设置

Railwise Core sidecar
  ├─ HTTP API
  ├─ SSE 事件流
  ├─ Agent Studio 文件热更新
  └─ 多智能体会话与工具调用
```

## 关键路径

- 启动：Tauri 启动 sidecar，前端等待初始化完成后进入 `/agents`。
- 数据预览：桌面端命令解析本地文件，前端渲染表格、图层或文档预览。
- 智能体任务：前端把上下文发送到 sidecar，sidecar 通过 SSE 推送状态和消息。
- Agent Studio：工作流预设通过 `/agent-studio/workflow/run` 创建真实会话，并写入首条 chief_manager 调度消息；智能体 7 天调用统计来自本地 message 表。
- 更新：Tauri updater 查询 `updates.railwise.cn` 或私有更新源，前端显示自定义更新弹窗。
- 埋点：默认关闭；开启后先写入本地队列，批量上报前执行脱敏。

## 边界纪律

- Core 不反向依赖 CLI 或 Desktop。
- CLI 不引入 Desktop-only 依赖，不承诺桌面安装体验。
- Desktop 不要求用户知道 CLI 命令，CLI sidecar 只是实现细节。
- `packages/app` 是共享 UI shell，Desktop 专属业务页面和文案归 `packages/desktop`。
- PR 必须能标注到 `core`、`cli`、`desktop`、`app` 或 `docs`。

Desktop v2 实施要求见 `/Users/WANGJIAWEI/CODE/RAILWISE-Desktop/RAILWISE-Desktop-开发实施文档-v2.0.md`。
