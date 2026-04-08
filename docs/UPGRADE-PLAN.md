# RAILWISE-CLI 升级计划

> 制定日期：2026-04-08  
> 版本：v1.3.0（实施中）  
> 状态：Phase 2-4 实施中

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

### 阶段 0：上游 Cherry-pick ✅

**目标**：将上游关键多智能体功能同步到 RAILWISE-CLI

#### 已完成

- ✅ `util/record.ts` — 新增 `isRecord()` 辅助函数
- ✅ `util/error.ts` — 新增 `errorMessage()`, `errorFormat()`, `errorData()` 统一错误处理工具
- ✅ `batch.ts` — 错误处理使用 `errorMessage()` 统一化
- ✅ TypeScript 类型检查通过
- ✅ Git 提交：`b8a247e0`

#### 说明

- ACP 协议 `src/acp/` 目录已存在，已针对 RAILWISE 品牌化
- Bus 系统已有实现（订阅模式，非 Effect/PubSub）
- ESM 兼容性已修复 ✅

---

### 阶段 1：并行调度系统 ✅

**目标**：实现 `parallel_agent` 工具，让多个 Agent 真正并行执行

#### 已完成

- ✅ `parallel_agent.ts` — 234 行完整实现
  - 使用 `Tool.define()` 模式
  - `Promise.all()` 并行执行
  - 每个 subtask 独立 Session + 权限隔离
  - 失败隔离（每个 subtask try/catch）
  - 错误聚合 + Markdown 格式输出
- ✅ `registry.ts` — 默认启用（无 feature flag）
- ✅ TypeScript 类型修复：闭包捕获 narrowing 问题
- ✅ Git 提交：`2a315af1`
- ✅ `chief_manager.md` — 已包含并行调度策略（Section 5）

#### 功能说明

```typescript
// 使用示例
parallel_agent({
  tasks: [
    { id: "tech", description: "技术方案", prompt: "...", subagent_type: "solution_architect" },
    { id: "biz", description: "商务报价", prompt: "...", subagent_type: "commercial_specialist" },
  ],
  maxConcurrency: 2
})
```

---

### 阶段 2：动态 Agent 生成 + 领域模板 ✅

**目标**：扩展 `rw agent create` CLI，支持测绘领域模板

#### 已完成

- ✅ `templates/settlement.md` — 水准沉降监测专家
- ✅ `templates/shield.md` — 盾构导向测量专家
- ✅ `templates/excavation.md` — 深基坑监测专家
- ✅ `templates/tunnel.md` — 隧道收敛监测专家
- ✅ `templates/control.md` — 控制网平差专家
- ✅ Git 提交：`4c5f086b`（含 ppt_master agent + 工具集）

#### 模板说明

每个模板包含：
- Frontmatter（model, mode, color, tools）
- 完整的系统提示词（含规范依据、工作流程）
- 专业工具集配置

#### 待完成

- [ ] 扩展 `rw agent create --template <type>` CLI 支持

---

### 阶段 3：TUI 多 Agent 进度面板 🔄

**目标**：在 TUI 中展示并行 Agent 执行进度

#### 进度组件

**文件**：`packages/app/src/components/AgentProgress.tsx`

```tsx
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

#### 布局设计

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

#### 事件订阅

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

| 阶段 | 目标 | 预计时间 | 版本 | 状态 |
|------|------|---------|------|------|
| 阶段 0 | 上游 Cherry-pick | 2 天 | - | ✅ 完成 |
| 阶段 1 | 并行调度系统 | 3 天 | v1.3.0-alpha | ✅ 完成 |
| 阶段 2 | 动态生成 + 模板 | 3 天 | v1.3.0-beta | ✅ 完成 |
| 阶段 3 | TUI 进度面板 | 2 天 | v1.3.0-rc | 🔄 进行中 |
| 阶段 4 | 文档同步 + 发布 | 1 天 | v1.3.0 | ⏳ 待开始 |

**已完成**：Phase 0-2  
**进行中**：Phase 3 TUI 进度面板  
**待开始**：Phase 4 文档同步 + GitHub 发布

---

## 五、风险与应对

| 风险 | 等级 | 应对措施 |
|------|------|---------|
| Cherry-pick 冲突多 | 🟡 中 | 手工合并，保留 RAILWISE 定制层 |
| 并行调度复杂 | 🟡 中 | 先实现简单版（固定 3 个并行），再扩展 |
| Effect 系统破坏现有代码 | 🔴 高 | 先在独立分支验证，不修改现有代码路径 |
| 文档同步遗漏 | 🟢 低 | CI 自动检查 + 发布前清单 |

---

## 六、PPT Master 同步（额外完成）

同步上游 `https://github.com/hugohe3/ppt-master` (v2.3.0→最新) 关键更新：

| 更新项 | 说明 |
|--------|------|
| `svg_finalize/` 子包 | finalize 脚本重构为子包结构 |
| 多后端图片生成 | `image_backends/` 支持 12+ 图片供应商 |
| Topic research workflow | 无源文档时从主题研究生成 |
| Tabler Icons | 图标库升级为 Tabler Icons |
| PPTX template source | create-template 支持 PPTX 模板 |
| 执行纪律强化 | 八步确认、逐页串行生成、禁止批量 |

**同步内容**：
- `ppt-master/skills/ppt-master/scripts/` → 本地 `tools/`（symlink）
- `ppt-master/skills/ppt-master/SKILL.md` → `.railwise/skill/ppt-master/`
- `ppt-master/skills/ppt-master/workflows/*.md` → `.railwise/skill/ppt-master/`
- `ppt_master.md` agent → 融入执行纪律和多格式支持
- Git 提交：`f6f88125`（含 provider/session/UI 更新）

---

## 七、团队分工建议

| 负责人 | 职责 |
|--------|------|
| WANGJIAWEI | 阶段 0-2（已完成）、阶段 4（发布） |
| （可扩展） | 阶段 3（TUI 进度面板） |

---

## 七、验收标准

### 功能验收

- [x] `rw --version` 输出正确版本
- [x] TypeScript 类型检查通过
- [x] `parallel_agent` 工具已注册（默认启用）
- [ ] `parallel_agent` 实际并行派发 3 个 Agent 测试
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
