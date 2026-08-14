# Desktop Harness Marketplace Beta QA

Desktop Beta QA 已迁到独立 `railwise-desktop-app` 仓库。本仓库只保留 Core/API、shared package 和 CLI sidecar 交付面。

Beta 验收仍应覆盖：

- macOS Apple Silicon / Intel 安装包。
- Windows x64 内部测试安装包。
- Workbench 首屏、执行层、权限队列和能力市场。
- 选择文件夹后创建会话并进入协作流程。
- 模型未配置时的接入引导。
- sidecar 启动、日志入口、崩溃恢复和 updater。

自动验收命令、Playwright 规格、视觉截图和发布阻断条件以 `railwise-desktop-app` 仓库当前文档为准。
