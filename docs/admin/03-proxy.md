# 企业代理配置

RAILWISE Desktop 的桌面壳和 sidecar 都需要正确处理企业代理。推荐让模型、更新、文档链接走企业 HTTP/SOCKS5 代理，本机 loopback 不走代理。

## 环境变量

在启动脚本或系统环境中配置：

```bash
HTTPS_PROXY=http://proxy.example.com:8080
HTTP_PROXY=http://proxy.example.com:8080
NO_PROXY=127.0.0.1,localhost,::1
```

Windows 可使用系统代理；如 WebView2 对 SSE 长连接不稳定，RAILWISE 会在桌面端走 Tauri HTTP 插件处理事件流。

## 无外网环境

1. 使用私有模型代理或本地模型。
2. 使用私有更新服务器。
3. 准备离线安装包。
4. 关闭启动时更新检查，避免启动时等待外网超时。
