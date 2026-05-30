# RAILWISE-CLI 安装、更新与启动

本页只说明命令行版本 RAILWISE-CLI。CLI 是工程测绘多智能体核心，适合工程人员本机使用、内业自动化、CI 脚本和内网服务器部署。

## 安装方式

### npm（推荐）

适用：Windows、macOS、Linux。需要先安装 Node.js 和 npm。

```bash
npm install -g railwise-ai@latest
railwise --version
rw --version
railwise agent list
```

当前已验证发布版本：**v1.2.30**（2026-05-30）。日常安装建议使用 `@latest`，企业内网锁版可使用 `railwise-ai@1.2.30`。

国内网络较慢时可指定镜像：

```bash
npm install -g railwise-ai@latest --registry=https://registry.npmmirror.com
```

### curl 安装脚本

适用：macOS、Linux。安装脚本会从 GitHub Release 下载对应平台的 `railwise` 二进制，并同时安装 `rw` 快捷命令。

```bash
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh
railwise --version
rw --version
```

指定版本：

```bash
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh -s 1.2.30
```

自定义安装目录：

```bash
RAILWISE_INSTALL_DIR="$HOME/.local/bin" \
  curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh
```

### Homebrew

适用：macOS、Linux。

```bash
brew install railwise-cn/tap/railwise
railwise --version
rw --version
```

### GitHub Release 手动安装

适用：离线环境、企业内网分发、没有 npm 的机器。

1. 打开 https://github.com/railwise-cn/RAILWISE-CLI/releases。
2. 下载对应平台包。
3. 解压后把 `railwise`/`rw` 或 `railwise.exe`/`rw.cmd` 放入 PATH。
4. 执行 `railwise --version` 或 `rw --version` 验证。

| 平台                | 文件                          |
| ------------------- | ----------------------------- |
| macOS Apple Silicon | `railwise-darwin-arm64.zip`   |
| Linux x64           | `railwise-linux-x64.tar.gz`   |
| Linux ARM64         | `railwise-linux-arm64.tar.gz` |
| Windows x64         | `railwise-windows-x64.zip`    |

## 命令别名

安装完成后，`railwise` 和 `rw` 是同一个 CLI 入口。文档示例默认使用 `railwise`，日常输入可以使用更短的 `rw`：

```bash
rw
rw run "检查本周监测数据并生成日报"
rw serve --hostname 127.0.0.1 --port 4096
```

### 源码开发安装

适用：开发 RAILWISE-CLI 本身或调试本地工具链。

```bash
git clone https://github.com/railwise-cn/RAILWISE-CLI.git
cd RAILWISE-CLI
bun install
bun run dev
```

仓库默认分支是 `dev`。开发时不要从仓库根目录运行测试，应进入对应 package。

## 更新方式

### CLI 自带更新

```bash
railwise upgrade
railwise upgrade 1.2.30
railwise upgrade --method npm
railwise upgrade --method brew
```

`railwise upgrade` 会尝试识别当前安装方式。识别失败时可用 `--method` 指定：`npm`、`pnpm`、`bun`、`brew`、`curl`、`choco`、`scoop`。新版安装包会同时带上内置 Agent、Command 和 Skill。

### 包管理器更新

```bash
npm install -g railwise-ai@latest
brew upgrade railwise
```

curl 安装可重新运行安装脚本：

```bash
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh
```

### 源码更新

```bash
git pull origin dev
bun install
bun run dev
```

## 配置

首次执行 `railwise` 会进入设置向导。也可以手动启动配置：

```bash
railwise setup
railwise auth login
```

项目级配置可放在 `.railwise/railwise.json`。全局凭据会保存到用户配置目录，不建议把 API Key 写入仓库。

## 启动方式

### 交互式 TUI

最常用方式，适合工程人员日常内业协作。

```bash
railwise
railwise /path/to/project
railwise --agent chief_manager
railwise --model deepseek/deepseek-chat
```

### 一次性任务

适合脚本、CI、批处理和自动化。

```bash
railwise run "检查本周监测数据并生成日报"
railwise run -f data.csv "分析沉降趋势，输出结论"
railwise run --agent data_analyst "校核这批水准闭合差"
```

### 本地服务模式

适合让其他界面、脚本或同网段客户端连接同一个 CLI 核心。

```bash
railwise serve --hostname 127.0.0.1 --port 4096
```

连接已有服务：

```bash
railwise attach http://localhost:4096
railwise run --attach http://localhost:4096 "继续整理报告"
```

对外开放服务时应设置 `RAILWISE_SERVER_PASSWORD`，避免未授权访问。

### Web 界面

```bash
railwise web
```

该命令会启动本地 RAILWISE 服务并打开浏览器界面。

### 源码开发模式

```bash
bun run dev
```

## 卸载

```bash
railwise uninstall
railwise uninstall --keep-config
railwise uninstall --keep-data
```

也可以使用安装时的包管理器卸载：

```bash
npm uninstall -g railwise-ai
brew uninstall railwise
```
