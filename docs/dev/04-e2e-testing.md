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
2. CSV 导入和预览
3. qa_inspector 首检报告
4. Agent Studio 热更新
5. 工作流流水线
6. DXF 图层切换
7. ppt_master 模板链路
8. 离线降级
9. 自动更新弹窗
10. sidecar 崩溃恢复
11. 视觉回归
12. TTFUI 小于 15 秒

## 视觉基准

视觉回归首次运行会生成 `/home` 极简协作入口截图基准。基准应随设计规范变更一起更新，禁止在未检查 UI 的情况下直接接受新截图。

## CI 建议

CI 运行时固定 Chromium 版本，并上传 `e2e/playwright-report` 作为构建产物。桌面端 E2E 只覆盖 macOS 本地/CI 验收；Windows 通过安装包工作流和内部安装验证覆盖。失败时先查看 trace，再判断是产品问题、基准图变更还是环境问题。
