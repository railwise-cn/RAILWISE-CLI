# RAILWISE 产品边界与开发实施文档

**文档版本**: v2.0
**编写日期**: 2026-04-30
**适用范围**: RAILWISE Core / RAILWISE CLI / RAILWISE Desktop
**执行仓库**: `railwise-cn/RAILWISE-CLI`
**当前原则**: 底层统一，产品分开

---

## 1. 决策摘要

RAILWISE 不再被定义为“CLI 的图形化桌面端”。这是错误叙事，会让开发、验收、发版和用户认知混在一起。

新的产品结构是：

- **RAILWISE Core**: 共享引擎，负责智能体、工作流、规范 Wiki、测量工具、会话、交付包和 HTTP/SSE 服务。
- **RAILWISE CLI**: 面向开发者、脚本、CI 和自动化的命令行产品。
- **RAILWISE Desktop**: 面向工程测绘和监测业务用户的可视化桌面工作台。

实现上继续保留 monorepo 和共享底层。产品上必须分开定位、分开发版、分开验收。

---

## 2. 为什么必须拆产品边界

CLI 和 Desktop 使用同一套底层能力，但用户买单理由不同。

CLI 用户关心：

- 命令是否稳定
- 能否接入脚本和 CI
- 输出是否可复现
- 配置是否可审计
- 能否批量跑工作流

Desktop 用户关心：

- 是否打开就能用
- 文件能否导入、预览、审阅、导出
- 工作流状态是否看得见
- 智能体结果是否能沉淀成交付包
- 安装、更新、签名是否可靠

如果继续把 Desktop 写成 CLI 外壳，团队会自然把命令行能力当作主线，把桌面体验当作包装层。结果是技术上很强，产品上很糊。用户看到的不是“工程智测工作台”，而是“命令行套了个窗口”。

---

## 3. 产品线定义

### 3.1 RAILWISE Core

**定位**: 所有产品共享的本地智能工程引擎。

**包含**:

- 智能体定义和调度
- Agent v2 工作流
- 规范 Wiki 和知识库维护
- 测量和平差工具
- 会话、消息、权限和 Provider
- 工作流交付包
- HTTP API、SSE 事件流、SDK 类型

**不包含**:

- 终端交互体验
- 桌面导航和业务页面
- 安装器、签名、公证、自动更新
- 面向用户的产品文案

**代码边界**:

- 主目录: `packages/railwise`
- SDK: `packages/sdk/js`
- 共享 UI 类型和客户端契约由 Core 输出，不能反向依赖 Desktop。

### 3.2 RAILWISE CLI

**定位**: 工程自动化和开发者入口。

**目标用户**:

- 开发者
- 自动化工程师
- CI/CD 管理员
- 高级实施顾问

**核心场景**:

- `railwise run` 批处理任务
- `railwise serve` 本地服务
- 配置、Provider、MCP、Agent 调试
- CI 内执行规范检查和报告生成
- 脚本化导入、导出、验收

**产品标准**:

- 命令稳定
- 输出机器可读
- 错误信息可定位
- 支持无头运行
- 支持 CI 环境

**代码边界**:

- 主目录: `packages/railwise/src/cli`
- CLI 不能引入 Desktop-only 依赖。
- CLI 文档不承诺桌面安装、可视化导航或本地文件预览体验。

### 3.3 RAILWISE Desktop

**定位**: 面向工程测绘和监测现场的一站式桌面工作台。

**目标用户**:

- 测绘项目经理
- 监测工程师
- 数据分析员
- 报告编制和审核人员

**核心场景**:

- 项目驾驶舱
- Agent Studio 可视化编排
- 数据工作台
- 文件导入、预览、对比和发送到智能体
- 工作流执行、验收和交付包导出
- 本地安装、离线使用、自动更新

**产品标准**:

- 默认进入可视化工作台
- 用户不需要知道 CLI 命令才能完成主流程
- 所有关键流程有状态、历史和导出物
- Windows/macOS/Linux 安装包可签名、可更新、可回滚

**代码边界**:

- 桌面壳: `packages/desktop`
- 复用前端: `packages/app`
- 本地能力: `packages/desktop/src-tauri`
- 桌面专属页面、文案和发布配置必须放在 Desktop 边界内。

---

## 4. 仓库分层

```text
RAILWISE monorepo
  ├─ packages/railwise        Core + CLI
  │  ├─ src/agent             Core: 智能体和工作流
  │  ├─ src/norm              Core: 规范 Wiki
  │  ├─ src/tool              Core: 工程工具
  │  ├─ src/server            Core: HTTP/SSE 服务
  │  └─ src/cli               CLI 产品入口
  ├─ packages/sdk/js          Core 对外 SDK
  ├─ packages/app             共享 Web UI shell
  ├─ packages/desktop         Desktop 产品入口
  ├─ docs/dev                 开发边界和架构文档
  ├─ docs/user                用户文档，按产品拆分
  └─ docs/admin               发布、部署、安全和运维文档
```

`packages/app` 是共享 UI 层，不是独立商业产品。它可以服务 Web 预览和 Desktop，但用户叙事必须由 CLI 或 Desktop 承接。

---

## 5. 开发泳道

### 5.1 Core Engine Ready

目标：让底层能力稳定、可测、可复用。

验收：

- Agent v2 工作流可通过 Core API 创建、运行、恢复和验收。
- 规范 Wiki 具备导入、索引、搜索、lint、diff 和报告能力。
- 测量工具具备单元测试和明确输入输出契约。
- 交付包具备 manifest、summary、artifact 列表和导出路径。
- SDK 类型跟随 API 变更生成并通过 typecheck。

### 5.2 CLI Developer Workflow Ready

目标：让高级用户可以不用桌面 UI 也完成自动化。

验收：

- CLI 命令可覆盖核心工作流启动、检查、导出。
- CLI 输出适合脚本读取。
- CI 可以使用 CLI 执行规范检查、测量工具验证和交付包生成。
- CLI 文档独立成章，不混入 Desktop 安装和 UI 承诺。

### 5.3 Desktop GA Ready

目标：让业务用户可以通过桌面完成端到端工作。

验收：

- 默认落地页是 Desktop 工作台，不是 Web 调试页。
- Agent Studio、Dashboard、Workspace、Session 形成完整闭环。
- 用户能从文件导入到智能体分析，再到交付包导出。
- 安装包、签名、公证、自动更新和崩溃恢复通过 GA 门禁。
- Desktop 文案不要求用户理解 CLI。

---

## 6. PR 和发版规则

### 6.1 PR 分组

每个 PR 必须声明所属产品线：

- `core`: 底层引擎、工具、API、SDK
- `cli`: 命令行入口、命令文档、自动化场景
- `desktop`: Tauri、安装器、桌面页面、桌面发布
- `app`: 共享 UI shell
- `docs`: 产品边界、用户文档、发布说明

PR 标题示例：

- `feat(core): archive workflow deliveries`
- `feat(cli): export workflow delivery package`
- `feat(desktop): show delivery package in workspace`
- `docs(product): define cli desktop core boundaries`

### 6.2 发版分离

CLI 和 Desktop 不共享版本承诺。

- CLI 使用包版本和 npm/binary 发布节奏。
- Desktop 使用 `desktop/vX.Y.Z` 标签和桌面 release workflow。
- Core 变更通过兼容性说明影响两条产品线。

Desktop GA 不应该被 CLI 新命令阻塞。CLI 发布也不应该等待 Desktop 签名、公证和安装包。

### 6.3 验收分离

Core 验收看 API、SDK、工具和测试。

CLI 验收看命令、脚本、CI 和可读输出。

Desktop 验收看可视化流程、安装、更新、本地文件、崩溃恢复和真实业务路径。

---

## 7. 立即执行计划

### P0: 文档和叙事修正

- [x] 新增本产品边界文档。
- [x] 根 README 改成 Core / CLI / Desktop 三产品线叙事。
- [x] `docs/dev/01-architecture.md` 改成三产品线架构。
- [x] `docs/dev/05-release-cadence.md` 明确 CLI 和 Desktop 发版分离。
- [x] `packages/desktop/README.md` 改成业务桌面工作台说明。
- [x] `packages/app/README.md` 改成共享 UI shell 说明。
- [x] `packages/railwise/README.md` 改成 Core + CLI 说明。

### P1: PR 和 backlog 重组

- [x] 当前 draft PR 标注为 Core + Desktop mixed delivery，保持 draft。
- [x] 从当前 PR 拆出后续 issue/任务：Core、CLI、Desktop、Docs 四类。
- [x] Desktop GA blockers 只保留签名、公证、更新、E2E、视觉和安装器。
- [x] CLI backlog 只保留命令、脚本、CI、无头运行和开发者文档。

### P2: 代码边界硬化

- [x] 检查 `packages/app` 中 Desktop-only 文案，迁移到 `packages/desktop` 或通过平台元数据注入。
- [ ] 检查 CLI 命令是否依赖 Desktop 路径或桌面配置。
- [ ] 将 delivery package 的 Core API、Desktop UI、CLI export 分别归档。
- [x] 为 PR 模板或提交规范增加产品线标签。

### P3: 发版流水线分离

- [ ] CLI 发布文档独立。
- [ ] Desktop release runbook 只描述桌面签名、公证、更新。
- [ ] Core 兼容性检查进入两条产品线共同前置门禁。

---

## 8. 不做什么

- 不立即拆仓库。
- 不复制 Core 代码给 Desktop。
- 不让 Desktop 依赖用户手动启动 CLI。
- 不把 Web 预览当成 Desktop 产品验收。
- 不在一个 PR 里继续混写 CLI、Desktop、Core 的用户承诺。

---

## 9. 成功标准

团队里的任何人看到一个任务，应能在 10 秒内判断它属于哪条产品线。

用户看到 Desktop，不会感觉自己在用命令行包装器。

开发者看到 CLI，不会被桌面安装和业务驾驶舱干扰。

Core 的能力越强，两个产品都受益，但产品叙事不再混在一起。
