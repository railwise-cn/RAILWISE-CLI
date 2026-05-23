# E2E 测试

M7 验收测试位于 `packages/desktop/e2e`，使用 Playwright。

## 本地运行

```bash
cd packages/desktop
bun run test:e2e
```

桌面静态快检可从仓库根目录运行：

```bash
bun run desktop:verify
```

需要包含本地 sidecar SSE 烟测和 Playwright E2E 时运行：

```bash
bun run desktop:verify -- --live
```

需要确认真实 Tauri 原生壳能启动 sidecar 时运行：

```bash
bun run desktop:verify -- --native
```

需要确认本地文件、updater、窗口、菜单仍在 Desktop/Tauri 原生边界内时运行：

```bash
bun run script/verify-desktop-native-surfaces.ts
```

发版前使用完整 30 分钟长连验收：

```bash
bun run desktop:verify -- --full
```

如果已经手动启动 Vite，可跳过 Playwright webServer：

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 \
PLAYWRIGHT_BASE_URL=http://127.0.0.1:5185 \
bun run test:e2e
```

## 用例覆盖

1. 启动和 sidecar 就绪时间
2. 项目文件夹、任务输入和 Harness 会话入口
3. 能力市场启用模型 Provider
4. 智能体配置页热更新
5. 工具与 Skills 面板
6. 能力市场智能体和工作流分类
7. DeepSeek / OpenRouter 模型接入引导
8. 离线 Harness 工作台
9. 自动更新弹窗
10. sidecar 崩溃恢复
11. 视觉回归
12. TTFUI 小于 3 秒
13. 设置中心 MCP、智能体和命令数据

## 视觉基准

视觉回归会附加 `/agents` Harness 工作台首屏截图，并检查旧工作台命名和编码智能体标签不再出现在主界面。基准应随设计规范变更一起更新，禁止在未检查 UI 的情况下直接接受新截图。

## CI 建议

CI 运行时固定 Chromium 版本，并上传 `e2e/playwright-report` 作为构建产物。失败时先查看 trace，再判断是产品问题、基准图变更还是环境问题。
