# App Shell 产品边界审查

**日期**: 2026-04-30
**范围**: `packages/app` / standalone `railwise-desktop-app`
**状态**: A1 completed

---

## 1. 结论

`packages/app` 继续作为共享 UI shell，不承接 CLI 或 Desktop 的商业产品叙事。

本轮审查发现并修正了两个边界泄漏点：

- App Shell 设置页直接读取 Desktop 产品名。
- App Shell 错误页和侧边栏帮助入口直接写死 Desktop 反馈链接。

修正后，App Shell 只消费 `Platform` 注入的通用元数据：

- `appName`: 宿主产品显示名。
- `supportUrl`: 宿主产品支持入口。

Desktop 在独立 `railwise-desktop-app` 仓库注入自己的产品名和支持入口。浏览器预览注入 App Shell 自己的名称和文档入口。

---

## 2. 代码边界

App Shell 可以保留以下平台能力抽象：

- 原生或服务端文件选择。
- 原生更新检查入口。
- 原生窗口标题栏适配。
- Web 预览使用的本地服务连接。

这些能力必须通过 `Platform` 接口暴露。App Shell 不能直接承诺某个商业产品的安装、签名、公证、更新或支持渠道。

Desktop-only 的产品文案、支持 URL、安装器、签名、公证和发版配置必须留在独立 Desktop 仓库或 Desktop 发布文档中。

---

## 3. 已完成变更

- `Platform` 新增 `appName` 和 `supportUrl`。
- Web 入口注入 `RAILWISE App Shell` 和通用文档 URL。
- Desktop 入口注入 `RAILWISE Desktop` 和 Desktop 支持 URL。
- 设置页底部产品名改为读取 `platform.appName`。
- 帮助入口和错误页报告入口改为读取 `platform.supportUrl`。
- i18n key 从 Desktop 命名改成 Application / Platform 命名。
- A1 扫描中的 `updater` / `installer` / `Tauri` 噪声已清理。

---

## 4. 验收

```bash
rg -n "installer|updater|notarization|codesign|Desktop GA|Tauri" packages/app/src packages/app/README.md
cd packages/app && bun run typecheck
```

第一条命令应无输出。第二条命令必须通过。
