# 架构概览

RAILWISE Desktop 由三层组成：

```text
Tauri 桌面壳
  ├─ 窗口、菜单、更新、系统集成
  ├─ Rust 本地命令：CAD / Office / CLI / sidecar
  └─ 本地日志、配置和 crash guard

SolidJS 前端
  ├─ /home 极简协作工作台
  ├─ /marketplace 能力市场
  ├─ /harness 执行层状态
  ├─ /workspace 数据与成果工作台
  ├─ /agents 高级智能体管理
  └─ 会话、模板、Prompt 队列、设置

Railwise sidecar
  ├─ HTTP API
  ├─ SSE 事件流
  ├─ Agent Studio 文件热更新
  └─ 多智能体会话与工具调用
```

## 关键路径

- 启动：Tauri 启动 sidecar，前端等待初始化完成后进入 `/home`；旧 `/dashboard` 入口重定向到极简工作台。
- 能力市场：`/marketplace` 只展示智能体、工具、Skills、MCP、模型 Provider 与 Harness Profile 的安装和配置入口；高级矩阵、模型路由和工作流编排留在 `/agents`。
- 数据预览：桌面端命令解析本地文件，前端渲染表格、图层或文档预览。
- 智能体任务：前端把上下文发送到 sidecar，sidecar 通过 SSE 推送状态和消息。
- Agent Studio：工作流预设通过 `/agent-studio/workflow/run` 创建真实会话，并写入首条 chief_manager 调度消息；智能体 7 天调用统计来自本地 message 表。
- 更新：Tauri updater 查询 `updates.railwise.cn` 或私有更新源，前端显示自定义更新弹窗。
- 埋点：默认关闭；开启后先写入本地队列，批量上报前执行脱敏。

完整 M1-M7 实施要求见 `/Users/WANGJIAWEI/CODE/RAILWISE-Desktop/RAILWISE-Desktop-开发实施文档-v1.0.md`。
