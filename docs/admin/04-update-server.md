# 私有更新服务器

更新服务器需要兼容 Tauri updater 的响应格式。仓库提供 Cloudflare Worker 实现：`workers/update-server`。

## 接口

```text
GET /desktop/{{target}}/{{current_version}}
```

示例响应：

```json
{
  "version": "1.3.1",
  "notes": "修复内测问题",
  "pub_date": "2026-04-26T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "...",
      "url": "https://cdn.example.com/railwise-desktop-darwin-aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "...",
      "url": "https://cdn.example.com/railwise-desktop-darwin-x64.app.tar.gz"
    }
  }
}
```

`url` 必须指向 Tauri updater 产物（macOS 为 `.app.tar.gz`），不要使用给用户手动安装的 `.dmg`。对应的 `.sig` 内容写入 `signature` 字段。
平台键使用 Tauri updater 的 `{{target}}` 值，例如 Apple Silicon 为 `darwin-aarch64`，Intel 为 `darwin-x86_64`；公开文件名可以继续使用 `darwin-x64`。

## 灰度发布

更新服务可按机器 ID hash 控制推送比例。推荐发布节奏：

1. RC 内测：固定测试机器。
2. GA 10%：观察 24 小时。
3. GA 30%：观察 24 小时。
4. GA 100%：全量推送。

## 验收

更新分发服务的本地验收脚本会使用内存 KV 调用 Worker `fetch()`，覆盖无版本、同版本、平台不支持、灰度 0%、国内 CDN、海外 CDN 和 `Cache-Control: no-store`。

```bash
cd workers/update-server
bun ./verify.ts
```

总体验收也会串联该脚本：

```bash
bun run desktop:verify
```

## 回滚

保留上一个稳定版本的安装包和签名。发现 P0/P1 问题时，将更新元数据回退到稳定版本或停止返回更新。
