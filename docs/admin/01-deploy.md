# 管理员部署

RAILWISE Desktop 支持公网分发、共享 NAS 分发和企业内网私有更新服务器三种模式。

## 公网分发

桌面端不发布 Linux 版本。正式公网分发只构建 macOS Apple Silicon 和 macOS Intel 两个 DMG；Windows 仅通过内部测试工作流生成未签名 x64 安装包，暂不进入公开 Release。发布产物上传到 Release 和对象存储，更新元数据由 `updates.railwise.cn` 返回。

Desktop 平台范围固定如下：

- macOS Apple Silicon：公开 DMG，需 Developer ID 签名和公证。
- macOS Intel：公开 DMG，需 Developer ID 签名和公证。
- Windows x64：内部测试 NSIS 安装包，暂不签名，暂不公开发布。
- Linux：不构建、不测试、不发布 Desktop 安装包；Linux 仅保留在 CLI 产品语境中。

## 共享 NAS 分发

将安装包放入企业共享目录，按平台建立子目录：

```text
RAILWISE/
  macos/RAILWISE_1.3.0_aarch64.dmg
  macos/RAILWISE_1.3.0_x64.dmg
  windows-internal/RAILWISE_1.3.0_x64-setup.exe
```

通知用户覆盖安装。Windows 内测包仅用于企业内部验证，不作为公开分发包。该模式不提供灰度更新，适合封闭网络。

## 私有更新源

将 Cloudflare Worker 或自建 Node 服务部署到企业可访问域名，保持接口兼容：

```text
GET /desktop/{{target}}/{{current_version}}
```

返回 Tauri updater JSON。更新包可以放在内网对象存储、NAS 静态服务或 Nginx。
