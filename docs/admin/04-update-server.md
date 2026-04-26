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
      "url": "https://cdn.example.com/RAILWISE_1.3.1_aarch64.dmg"
    }
  }
}
```

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
