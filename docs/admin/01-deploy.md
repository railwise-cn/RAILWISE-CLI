# 管理员部署

RAILWISE Desktop 支持公网分发、共享 NAS 分发和企业内网私有更新服务器三种模式。

## 公网分发

使用 GitHub Actions 的桌面发布流程构建 macOS、Windows、Linux 安装包。发布产物上传到 Release 和对象存储，更新元数据由 `updates.railwise.cn` 返回。

## 共享 NAS 分发

将安装包放入企业共享目录，按平台建立子目录：

```text
RAILWISE/
  windows/RAILWISE_1.3.0_x64-setup.exe
  macos/RAILWISE_1.3.0_aarch64.dmg
  linux/railwise_1.3.0_amd64.deb
```

通知用户覆盖安装。该模式不提供灰度更新，适合封闭网络。

## 私有更新源

将 Cloudflare Worker 或自建 Node 服务部署到企业可访问域名，保持接口兼容：

```text
GET /desktop/{{target}}/{{current_version}}
```

返回 Tauri updater JSON。更新包可以放在内网对象存储、NAS 静态服务或 Nginx。
