# 发版节奏

RAILWISE Desktop 使用 `desktop/v{major}.{minor}.{patch}` 标签发布，版本号与桌面包、Tauri 配置和更新服务器 manifest 保持一致。

## RC1

RC1 进入 5 天内测，覆盖 10 名工程师或 PM 的真实项目样本，并完整运行 M7 的 12 条 E2E 用例。

P0 包含崩溃、数据丢失、签名失败、公证失败和更新失败，必须当日修复。P1 包含功能缺失和严重 UI 异常，修复后并入 RC2。P2 体验优化进入下一迭代 backlog。

## RC2

RC2 在 P0/P1 清零后发布，验证期 3 天。回归范围必须包含崩溃恢复、自动更新、视觉回归、TTFUI、CSV 导入、高级智能体管理、工作流流水线和 PPT 生成。

## GA

GA 发布版本为 `desktop/v1.3.0` 起步。更新服务器按 10%、30%、100% 灰度推进，每阶段间隔 24 小时。GitHub Release 需要附 changelog，内网分发由管理员通过私有更新服务器推送。

## 发布前检查

```bash
cd workers/update-server && bun ./verify.ts
cd packages/app && bun run typecheck
cd packages/ui && bun run typecheck
cd packages/desktop && bun run build
cd packages/desktop/src-tauri && cargo check
cd packages/desktop && bun run test:e2e
```

发布前还必须执行品牌残留扫描，确保当前 UI、桌面壳和交付文档不再出现旧工作台命名。

仓库根目录的总体验收入口会串联品牌残留扫描、M6 发布配置、M7 内测验收、更新分发服务验收和各 package typecheck：

```bash
bun run desktop:verify
```

GA 前置检查会额外校验版本一致性、发版文档、更新服务配置和 changelog：

```bash
bun run desktop:verify:ga
```

正式发版前执行完整 live gate：

```bash
bun run desktop:verify:ga -- --full
```
