# Core Compatibility Gate

本文档用于判断 Core 变更是否可以同时进入 CLI 和 Desktop。Core 不直接面向终端用户发版，但它会进入 CLI 包、Desktop sidecar、App shell 和 JavaScript SDK，因此破坏性 Core 变更会同时阻断两条产品线。

## 触发条件

只要本次变更触碰以下任一内容，就必须执行本门禁：

- HTTP API 或 SSE 事件流。
- JavaScript SDK 类型或导出。
- Agent v2、workflow、handoff、acceptance 或 delivery package 契约。
- 规范 Wiki、测量工具、工程计算工具的输入输出格式。
- 数据库 schema、migration 或本地文件格式。
- Core 配置项、provider、permission 或 session 存储。

纯 CLI 命令文案、纯 Desktop UI、纯 App shell 布局变更不需要执行本门禁，除非它们依赖新的 Core 契约。

## 必跑检查

```bash
cd packages/railwise && bun run typecheck
cd packages/railwise && bun test --timeout 30000
cd packages/sdk/js && bun run typecheck
```

如果 API 或 SDK 发生变化，先重新生成 SDK：

```bash
./packages/sdk/js/script/build.ts
cd packages/sdk/js && bun run typecheck
```

如果 delivery package 契约发生变化，至少覆盖服务端和 agent workflow 回归：

```bash
cd packages/railwise && bun test --timeout 30000 test/server/agent-studio.test.ts test/agent/railwise-v2.test.ts
```

如果规范 Wiki 或测量工具发生变化，运行对应 Core 测试：

```bash
cd packages/railwise && bun test --timeout 30000 test/tool/wiki.test.ts test/tool/adjustment.test.ts
```

## 兼容性判断

| 变更类型                       | CLI          | Desktop          | 结论                   |
| ------------------------------ | ------------ | ---------------- | ---------------------- |
| 新增可选 API 字段              | 不阻断       | 不阻断           | 记录 changelog         |
| 删除或重命名 API 字段          | 阻断         | 阻断             | 需要迁移或兼容层       |
| SDK 类型新增导出               | 不阻断       | 不阻断           | 重新生成 SDK           |
| SDK 类型删除或改名             | 阻断         | 阻断             | 需要迁移说明           |
| delivery manifest 新增可选字段 | 不阻断       | 不阻断           | 更新文档和 fixture     |
| delivery manifest 必填字段变化 | 阻断         | 阻断             | 需要版本字段和兼容读取 |
| 数据库向前兼容 migration       | 不阻断       | 不阻断           | 需要回滚说明           |
| 本地文件格式不可逆变化         | 阻断         | 阻断             | 需要备份和迁移计划     |
| CLI-only flag 或输出改动       | 可能阻断 CLI | 不阻断           | 归入 CLI release       |
| Desktop-only UI 或安装改动     | 不阻断       | 可能阻断 Desktop | 归入 Desktop release   |

## 记录要求

每个触发门禁的 PR 必须在描述中写明：

- 影响的 Core 契约。
- 是否需要 SDK 重新生成。
- 是否需要数据或文件迁移。
- CLI 需要执行的验证命令。
- Desktop 需要执行的验证命令。
- 是否存在向后不兼容风险。

如果存在破坏性变更，必须同时提供：

- 迁移路径。
- 回滚路径。
- 最小兼容窗口。
- 对 CLI 和 Desktop 的用户可见影响。

## 发版关系

Core compatibility gate 是 CLI 和 Desktop 的共同前置门禁，但它不是独立 release。

- Core 兼容：CLI 和 Desktop 可以各自按产品节奏继续发布。
- Core 破坏：CLI 与 Desktop 均不得发布，直到兼容层、迁移或版本化契约完成。
- CLI-only 破坏：只阻断 CLI 发布。
- Desktop-only 破坏：只阻断 Desktop 发布。
