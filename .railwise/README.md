# RAILWISE Agent Pack

`.railwise` 是本仓库随 CLI/Core 一起维护的 RAILWISE Agent Pack。它提供工程测绘业务智能体、命令、技能、工具、模板和主题资源；Desktop 只消费发布后的 CLI sidecar、SDK、共享包和这些资源，不把 Desktop 源码或发布流程放回本仓库。

## Canonical Layout

```text
.railwise/
  agent/*.md              Agent prompt 定义
  command/*.md            SOP / slash command 模板
  skill/*/SKILL.md        可发现的业务技能包
  tool/*.ts               可发现的自定义工具入口
  lib/*.ts                工具共享代码，不作为工具直接加载
  templates/*.json        报告、方案、PPT 等模板定义
  themes/*.json           TUI / Web 主题
  railwise.json.example   项目配置示例
```

保持资源入口扁平化：不要提交 `agent/foo/foo.md`、`command/foo/foo.md`、`tool/foo/foo.ts` 这类打包产物目录。技能包可以有自己的 `assets/`、`references/`、`scripts/`，但入口必须是 `skill/<name>/SKILL.md`。

## Product Boundary

- CLI/Core 负责加载、运行、测试和分发 Agent Pack。
- Agent Pack 只放业务资源和工具共享代码，不放 Desktop shell、Tauri、安装器或 updater 逻辑。
- Desktop 在独立 `railwise-desktop-app` 仓库维护产品 UX、原生能力、安装包、签名、公证和自动更新。
- Linux 只交付 CLI，不在本仓库承诺 Desktop 安装包。
