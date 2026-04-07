# RAILWISE-CLI 升级计划

> 制定日期：2026-04-08  
> 版本：v1.3.0（规划）  
> 状态：规划中

---

## 一、背景与目标

### 1.1 当前问题

- RAILWISE-CLI 最后同步上游 OpenCode 版本为 v1.2.8，当前上游最新为 **v1.3.17**（跨越 15 个版本）
- 多智能体协作为串行模式，效率低
- 缺少并行调度、外部集成、子 Agent 进度可视化管理

### 1.2 目标

1. **同步上游关键功能**：Cherry-pick 多智能体相关新特性，不做完整合主干
2. **增强多智能体协作**：实现并行调度、动态生成、进度可视化管理
3. **文档同步**：GitHub 文档与本地文档保持一致

### 1.3 同步策略

**不上**：完整合主干（重命名太多，500+ commits，冲突巨大）  
**上**：Cherry-pick 关键文件 + 重建定制层

---

## 二、Cherry-pick 上游关键功能清单

### 2.1 优先级 P0（必须同步）

| 功能 | 文件 | 说明 |
|------|------|------|
| ACP 协议服务器 | `src/acp/` | Agent Client Protocol，支持外部 AI 客户端接入 |
| 并行工具批处理 | `src/tool/batch.ts` | 多工具并行执行（限 25 个/批） |
| Effect 系统重构 | `src/bus/`, `src/effect/` | 更现代的依赖注入和服务层 |
| Agent 创建 CLI | `src/cli/cmd/agent.ts` | AI 自动生成新 Agent |

### 2.2 优先级 P1（建议同步）

| 功能 | 文件 | 说明 |
|------|------|------|
| 子 Agent TUI 组件 | `src/cli/cmd/tui/routes/session/dialog-subagent.tsx` | 子会话视图管理 |
| 工具批量执行 | `src/tool/batch.ts` + `batch.txt` | batch tool 描述文件 |
| GitHub Triage 工具 | `.opencode/tool/github-triage.ts` | Issue/PR 分类工具 |

### 2.3 不同步（定制层已有）

| 功能 | 说明 |
|------|------|
| `.opencode/agent/` | RAILWISE-CLI 已有完整的 `.railwise/agent/` |
| `.opencode/tool/` | RAILWISE-CLI 已有 19 个测绘专用工具 |
| `packages/opencode/` | 源码重命名为 `packages/railwise/` |

---

## 三、升级实施计划

### 阶段 0：上游 Cherry-pick（第 1-2 天）

**目标**：将上游关键多智能体功能同步到 RAILWISE-CLI

#### 0.1 创建同步分支

```bash
git checkout -b feature/upstream-sync
```

#### 0.2 Cherry-pick 关键文件

```bash
# 1. ACP 协议
git cherry-pick --no-commit <acp-commits>
# 路径映射：packages/opencode/src/acp → packages/railwise/src/acp

# 2. 并行工具批处理
git checkout upstream/dev -- packages/opencode/src/tool/batch.ts
git checkout upstream/dev -- packages/opencode/src/tool/batch.txt

# 3. Effect 系统重构
git checkout upstream/dev -- packages/opencode/src/bus/

# 4. Agent 创建 CLI（合并版本）
# 需要对比 RAILWISE-CLI 和 upstream 的差异，手动合并
```

#### 0.3 适配工作

- [ ] `acp/` import 路径从 `@opencode-ai/*` 改为 `@railwise/*`
- [ ] `bus/` import 路径适配
- [ ] `batch.ts` 权限检查适配 `PermissionNext`
- [ ] TypeScript 类型检查修复
- [ ] `bin/railwise` ESM 兼容性（已修复 ✅）

#### 0.4 验证

```bash
cd packages/railwise && bun run typecheck
```

---

### 阶段 1：并行调度系统（第 3-5 天）

**目标**：实现 `parallel_agent` 工具，让多个 Agent 真正并行执行

#### 1.1 新工具：`parallel_agent`

**文件**：`packages/railwise/src/tool/parallel_agent.ts`  
**描述**：并行调度多个 Agent，支持依赖声明

```typescript
const parameters = z.object({
  tasks: z.array(z.object({
    id: z.string().describe("任务唯一ID"),
    agent: z.string().describe("Agent 名称"),
    prompt: z.string().describe("任务描述"),
    depends_on: z.array(z.string()).optional().describe("依赖的任务ID列表"),
  })).describe("任务列表"),
  strategy: z.enum(["auto", "explicit"]).default("auto")
})
```

#### 1.2 调度算法

- 构建 DAG（有向无环图）表示任务依赖
- Topological sort 确定执行顺序
- 无依赖任务并行派发（最多 3 个同时执行）
- 有依赖任务等待前置任务完成后执行

#### 1.3 chief_manager 改造

更新 prompt，引导 chief_manager 使用并行调度：

```markdown
**并行调度原则**：
- 互不依赖的子任务必须并行派发（如：技术方案设计 + 商务报价）
- 可并行任务数上限为 3，超过时分批执行
- 使用 parallel_agent 工具一次性提交所有可并行任务
- 依赖任务在 parallel_agent 返回结果后再串行执行
```

#### 1.4 测试

```bash
# 单元测试
bun test test/tool/parallel_agent.test.ts

# 集成测试：并行派发 qa_inspector + solution_architect
```

---

### 阶段 2：动态 Agent 生成 + 领域模板（第 6-8 天）

**目标**：扩展 `rw agent create` CLI，支持测绘领域模板

#### 2.1 扩展 `rw agent create`

```bash
# 基础用法（通用）
rw agent create --description "沉降数据分析专家" --mode subagent

# 领域模板用法（新增）
rw agent create --template settlement    # 水准沉降监测专家
rw agent create --template shield       # 盾构导向测量专家
rw agent create --template excavation   # 基坑监测专家
rw agent create --template tunnel       # 隧道收敛监测专家
rw agent create --template control      # 控制网平差专家
```

#### 2.2 模板定义

**文件**：`.railwise/agent/templates/`

```
templates/
├── settlement.md    # 沉降监测模板
├── shield.md        # 盾构导向模板
├── excavation.md    # 基坑监测模板
├── tunnel.md        # 隧道收敛模板
└── control.md      # 控制网平差模板
```

每个模板包含：
- Frontmatter（model, mode, tools, color）
- 系统提示词模板
- 专用工具配置

#### 2.3 模板生成器

```typescript
// packages/railwise/src/cli/cmd/agent-templates.ts
const TEMPLATES = {
  settlement: {
    name: "沉降监测专家",
    model: "deepseek/deepseek-chat",
    color: "#2ECC71",
    description: "专注于水准沉降数据分析与预警研判",
    tools: ["deformation_rate", "survey_calculator", "chart_generator"],
    systemPrompt: `你是一位水准沉降监测专家...`
  },
  // ...
}
```

---

### 阶段 3：TUI 多 Agent 进度面板（第 9-10 天）

**目标**：在 TUI 中展示并行 Agent 执行进度

#### 3.1 进度组件

**文件**：`packages/app/src/components/AgentProgress.tsx`

```tsx
// 状态设计
type AgentStatus = "pending" | "running" | "completed" | "failed"

interface AgentTask {
  id: string
  name: string
  status: AgentStatus
  startedAt?: Date
  completedAt?: Date
  result?: string
  error?: string
}
```

#### 3.2 布局设计

```
┌─ Railwise 多智能体协作 ─────────────────────────┐
│                                                    │
│  🔄 solution_architect   [████████░░] 80%       │
│     生成深基坑监测方案...                          │
│                                                    │
│  ✅ qa_inspector       [██████████] 完成         │
│     数据检验通过 ✓                                │
│                                                    │
│  ⏳ data_analyst       等待中                   │
│     等待 qa_inspector 完成                       │
│                                                    │
│  🔄 commercial_specialist [████░░░░░░] 40%       │
│     编制商务报价...                               │
│                                                    │
└──────────────────────────────────────────────────┘
```

#### 3.3 事件订阅

复用 Bus 系统订阅 Agent 状态变更：

```typescript
Bus.subscribe("agent.started", (event) => updateTask(event.taskId, "running"))
Bus.subscribe("agent.completed", (event) => updateTask(event.taskId, "completed"))
```

---

### 阶段 4：文档同步（第 11 天）

**目标**：GitHub 文档与本地文档保持一致

#### 4.1 文档清单

| 文档位置 | 说明 | 同步策略 |
|---------|------|---------|
| `README.md` | 项目主文档 | 手动维护 |
| `packages/docs/` | Mintlify 文档站 | GitHub Pages 部署 |
| `.railwise/skill/*/SKILL.md` | 技能包文档 | 随功能更新 |
| CHANGELOG.md | 变更日志 | 自动生成 |

#### 4.2 GitHub 发布检查清单

```bash
# 发布前检查
- [ ] README.md 功能列表已更新
- [ ] 新增工具已添加到工具说明
- [ ] 新增 Agent 已添加到智能体说明
- [ ] CHANGELOG.md 已生成
- [ ] 版本号已更新（package.json, railwise.json）
- [ ] 本地文档已同步（packages/docs/）
- [ ] CI 测试通过
- [ ] e2e 测试通过
```

#### 4.3 CI 自动同步

在 `.github/workflows/` 添加文档同步 workflow：

```yaml
name: sync-docs
on:
  push:
    branches: [main]

jobs:
  sync-docs:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Sync to GitHub Pages
        run: |
          # 将 packages/docs/ 内容推送到 gh-pages 分支
```

---

## 四、里程碑

| 阶段 | 目标 | 预计时间 | 版本 |
|------|------|---------|------|
| 阶段 0 | 上游 Cherry-pick | 2 天 | - |
| 阶段 1 | 并行调度系统 | 3 天 | v1.3.0-alpha |
| 阶段 2 | 动态生成 + 模板 | 3 天 | v1.3.0-beta |
| 阶段 3 | TUI 进度面板 | 2 天 | v1.3.0-rc |
| 阶段 4 | 文档同步 + 发布 | 1 天 | v1.3.0 |

**总计**：约 11 个工作日

---

## 五、风险与应对

| 风险 | 等级 | 应对措施 |
|------|------|---------|
| Cherry-pick 冲突多 | 🟡 中 | 手工合并，保留 RAILWISE 定制层 |
| 并行调度复杂 | 🟡 中 | 先实现简单版（固定 3 个并行），再扩展 |
| Effect 系统破坏现有代码 | 🔴 高 | 先在独立分支验证，不修改现有代码路径 |
| 文档同步遗漏 | 🟢 低 | CI 自动检查 + 发布前清单 |

---

## 六、团队分工建议

| 负责人 | 职责 |
|--------|------|
| WANGJIAWEI | 阶段 0、阶段 4（发布） |
| （可扩展） | 阶段 1-3（实现） |

---

## 七、验收标准

### 功能验收

- [ ] `rw --version` 输出正确版本
- [ ] `rw acp` 可启动 ACP 服务器
- [ ] `parallel_agent` 工具可并行派发 3 个 Agent
- [ ] `rw agent create --template settlement` 可生成沉降监测专家
- [ ] TUI 显示多 Agent 并行进度面板
- [ ] 所有单元测试通过
- [ ] e2e 测试通过

### 文档验收

- [ ] README.md 包含新功能说明
- [ ] `packages/docs/` 与 README.md 内容一致
- [ ] CHANGELOG.md 包含本次所有变更

### 发布验收

- [ ] GitHub Release 已创建
- [ ] npm 包已发布
- [ ] CI 所有流水线绿色
