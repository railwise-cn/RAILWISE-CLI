# RAILWISE-CLI 记忆系统设计方案

> Status: Draft
> Author: Sisyphus
> Date: 2026-02-27
> Branch: `feat/memory-system`

---

## 目录

1. [问题定义](#1-问题定义)
2. [设计目标](#2-设计目标)
3. [架构概览](#3-架构概览)
4. [Phase 1：自动记忆提取与注入](#4-phase-1自动记忆提取与注入)
5. [Phase 2：语义搜索](#5-phase-2语义搜索)
6. [Phase 3：智能记忆管理](#6-phase-3智能记忆管理)
7. [与现有代码集成点](#7-与现有代码集成点)
8. [配置方案](#8-配置方案)
9. [数据库 Schema](#9-数据库-schema)
10. [关键文件清单](#10-关键文件清单)
11. [验证方案](#11-验证方案)

---

## 1. 问题定义

当前 RAILWISE-CLI 每次新会话从零开始。用户需要反复解释项目上下文、重述过去的决策。
已有的 AGENTS.md 机制是纯手动的，compaction 摘要仅在单会话内有效。

**痛点**：
- 跨会话知识丢失（昨天的监测方案设计、平差参数选择）
- 工程测绘领域有大量 **项目特定知识**（控制点坐标系、测站配置、报警阈值）需要持久记忆
- 团队协作时，不同成员的会话产出无法自动共享

---

## 2. 设计目标

| 目标 | 描述 | 优先级 |
|------|------|--------|
| 自动化 | 无需用户手动维护，自动从会话中提取有用知识 | P0 |
| 零配置启用 | 默认开启，无需额外配置即可工作 | P0 |
| 隐私安全 | 所有数据本地存储，不上传到任何服务 | P0 |
| 低噪音 | 只注入相关记忆，不浪费 context window | P0 |
| 可控性 | 用户能查看、编辑、删除记忆 | P1 |
| 轻量依赖 | 不引入重型外部依赖（如 hnswlib） | P1 |
| 与现有架构兼容 | 复用 Drizzle/SQLite/Plugin 体系 | P0 |

---

## 3. 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    RAILWISE-CLI Memory System                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │  Extraction   │    │   Storage    │    │  Injection   │  │
│  │              │    │              │    │              │  │
│  │ compaction ──►│──►│  SQLite DB   │──►│──► system     │  │
│  │ session end──►│    │  (memory表)  │    │   prompt     │  │
│  │ user cmd ───►│    │              │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│                            │                                │
│                            ▼                                │
│                   ┌──────────────┐                          │
│                   │  Retrieval   │                          │
│                   │              │                          │
│                   │ FTS5 全文搜索 │  ← Phase 1              │
│                   │ 向量相似度   │  ← Phase 2              │
│                   └──────────────┘                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 与 Claude Code 记忆模型的对比

| 特性 | Claude Code | RAILWISE-CLI (本方案) |
|------|-------------|----------------------|
| 手动记忆 | CLAUDE.md 文件层次 | AGENTS.md (已有，保持不变) |
| 自动记忆 | auto-memory.md (~200行) | SQLite memory 表 + FTS5 |
| Session Memory | 后台摘要 | compaction summary 复用 |
| 检索方式 | 全量加载前200行 | 按相关性检索 top-N |
| 存储格式 | Markdown 文件 | 结构化 DB (支持查询/过滤/排序) |

**关键差异**：Claude Code 的 auto-memory 是一个 flat 文件，全量加载。我们用结构化 DB + 检索，更节省 token。

---

## 4. Phase 1：自动记忆提取与注入

### 4.1 数据模型

```typescript
// src/memory/memory.sql.ts
import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"
import { ProjectTable } from "../project/project.sql"
import { SessionTable } from "../session/session.sql"
import { Timestamps } from "@/storage/schema.sql"

export const MemoryTable = sqliteTable(
  "memory",
  {
    id: text().primaryKey(),
    project_id: text()
      .notNull()
      .references(() => ProjectTable.id, { onDelete: "cascade" }),
    session_id: text().references(() => SessionTable.id, { onDelete: "set null" }),
    category: text().notNull(), // 'discovery' | 'decision' | 'pattern' | 'preference' | 'error' | 'fact'
    content: text().notNull(),
    source: text(),             // 来源描述，如 "session compaction" / "user command"
    confidence: real().notNull().default(1.0),
    access_count: integer().notNull().default(0),
    ...Timestamps,
    time_accessed: integer(),
    time_expired: integer(),    // 软过期
  },
  (table) => [
    index("memory_project_idx").on(table.project_id),
    index("memory_category_idx").on(table.category),
    index("memory_confidence_idx").on(table.confidence),
  ],
)
```

### 4.2 记忆分类

| Category | 含义 | 示例 | 提取来源 |
|----------|------|------|---------|
| `discovery` | 项目/代码库发现 | "该项目使用 CGCS2000 坐标系" | compaction Discoveries |
| `decision` | 用户/系统决策 | "选择了最小二乘法进行平差计算" | compaction Goal + Accomplished |
| `pattern` | 代码/工作流模式 | "报告格式使用 A4 横版, 含变形曲线图" | compaction Instructions |
| `preference` | 用户偏好 | "用户偏好使用 DeepSeek 模型" | 多次出现的行为模式 |
| `error` | 经验教训 | "全站仪数据需要先做气象改正再归算" | 错误修复记录 |
| `fact` | 项目事实 | "甲方要求每日上传监测日报" | 用户明确陈述 |

### 4.3 提取流程

#### 触发点 1：Compaction 结束时

现有 `compaction.ts` 的 `process()` 已经生成结构化摘要（Goal/Instructions/Discoveries/Accomplished）。
利用 `experimental.session.compacting` plugin hook **或** 直接在 compaction 完成后触发提取。

```typescript
// src/memory/extract.ts
export namespace MemoryExtract {
  // 从 compaction summary 中提取记忆碎片
  export async function fromCompaction(input: {
    sessionID: string
    projectID: string
    summary: string   // compaction 生成的 markdown 摘要
  }) {
    // 解析 markdown 摘要的各个 section
    const sections = parseSections(input.summary)

    const memories: NewMemory[] = []

    // Discoveries → discovery 类记忆
    for (const item of sections.discoveries) {
      memories.push({
        category: "discovery",
        content: item,
        source: `session:${input.sessionID}`,
        confidence: 0.8,
      })
    }

    // Goal + Accomplished → decision 类记忆
    if (sections.goal) {
      memories.push({
        category: "decision",
        content: sections.goal,
        source: `session:${input.sessionID}`,
        confidence: 0.9,
      })
    }

    // Instructions → pattern 类记忆
    for (const item of sections.instructions) {
      memories.push({
        category: "pattern",
        content: item,
        source: `session:${input.sessionID}`,
        confidence: 0.7,
      })
    }

    // 去重：与现有记忆比较，避免重复存储
    await deduplicate(input.projectID, memories)
  }

  function parseSections(markdown: string) {
    // 解析 compaction 的标准 markdown 格式
    // ## Goal / ## Instructions / ## Discoveries / ## Accomplished / ## Relevant files
    // ...
  }
}
```

#### 触发点 2：Session 归档/结束时

当用户切换到新 session 或显式归档时，对上一个 session 做最终提取。

```typescript
// 在 Session.create() 或 Session.setArchived() 中触发
Bus.subscribe(Session.Event.Created, async (event) => {
  // 检查是否有上一个活跃 session 需要归档
  // 如果有 compaction summary，提取记忆
})
```

#### 触发点 3：用户命令（手动）

新增 `/remember` 命令，允许用户显式添加记忆：

```
/remember 该项目控制点坐标系为 CGCS2000，中央子午线 121°
```

### 4.4 去重策略

```typescript
export async function deduplicate(projectID: string, candidates: NewMemory[]) {
  const existing = await Memory.list({ projectID })
  const results: NewMemory[] = []

  for (const candidate of candidates) {
    // Phase 1: 简单文本相似度（Jaccard / 编辑距离）
    const similar = existing.find((m) =>
      textSimilarity(m.content, candidate.content) > 0.7
    )
    if (similar) {
      // 增强已有记忆的置信度
      await Memory.boost({ id: similar.id, delta: 0.1 })
      continue
    }
    results.push(candidate)
  }
  return results
}
```

### 4.5 注入流程

#### 注入时机

在 `SessionPrompt.loop()` 的系统 prompt 构建阶段注入，具体位于 `SystemPrompt.environment()` 之后、`InstructionPrompt.system()` 之后。

```typescript
// src/memory/inject.ts
export namespace MemoryInject {
  export async function system(input: {
    projectID: string
    sessionID: string
    limit?: number
  }): Promise<string[]> {
    const config = await Config.get()
    if (config.memory?.enabled === false) return []

    const limit = config.memory?.maxMemories ?? 10
    const memories = await Memory.relevant({
      projectID: input.projectID,
      limit,
    })

    if (memories.length === 0) return []

    // 更新 access_count
    await Memory.touch(memories.map((m) => m.id))

    const formatted = memories.map((m) =>
      `[${m.category}] ${m.content}`
    ).join("\n")

    return [
      `<project-memory>`,
      `The following are automatically recalled memories from previous sessions with this project.`,
      `Use them as context but verify if needed — they may be outdated.`,
      ``,
      formatted,
      `</project-memory>`,
    ].join("\n")
  }
}
```

#### 集成点：`prompt.ts` 中的系统 prompt 构建

```typescript
// 在 prompt.ts 的 loop() 函数中，约 L654 附近
const system = [
  ...(await SystemPrompt.environment(model)),
  ...(await InstructionPrompt.system()),
  // ↓ 新增：注入项目记忆
  ...(await MemoryInject.system({
    projectID: Instance.project.id,
    sessionID,
  })),
]
```

### 4.6 检索策略（Phase 1）

Phase 1 使用**简单评分排序**，无需向量化：

```typescript
export async function relevant(input: {
  projectID: string
  limit: number
}) {
  // 按 (confidence * recency_weight * frequency_weight) 排序
  // recency_weight: 越近的记忆权重越高
  // frequency_weight: 被多次访问的记忆权重越高
  return Database.use((db) =>
    db
      .select()
      .from(MemoryTable)
      .where(
        and(
          eq(MemoryTable.project_id, input.projectID),
          isNull(MemoryTable.time_expired),
        ),
      )
      .orderBy(desc(MemoryTable.confidence))
      .limit(input.limit)
      .all()
  )
}
```

---

## 5. Phase 2：语义搜索

### 5.1 方案选型

| 方案 | 依赖 | 优点 | 缺点 |
|------|------|------|------|
| **SQLite FTS5** | 无（SQLite 内置） | 零依赖，全文搜索 | 无语义理解 |
| **hnswlib-wasm** | npm包，需要 C++ 编译 | 本地向量搜索 | 编译复杂 |
| **LLM 生成嵌入** | 调用模型 API | 语义准确 | 有成本、需网络 |
| **本地嵌入模型** | Transformers.js / ONNX | 离线、免费 | 包体大 |

**推荐**：Phase 2a 先加 SQLite FTS5（零依赖），Phase 2b 再可选引入本地嵌入。

### 5.2 FTS5 集成

```sql
-- 新增 FTS5 虚拟表
CREATE VIRTUAL TABLE memory_fts USING fts5(
  content,
  category,
  content=memory,
  content_rowid=rowid
);

-- 触发器同步
CREATE TRIGGER memory_ai AFTER INSERT ON memory BEGIN
  INSERT INTO memory_fts(rowid, content, category)
  VALUES (new.rowid, new.content, new.category);
END;
```

### 5.3 上下文感知检索

```typescript
// 根据用户当前消息内容搜索相关记忆
export async function search(input: {
  projectID: string
  query: string
  limit: number
}) {
  // 使用 FTS5 的 MATCH 语法
  const results = Database.use((db) =>
    db.all(sql`
      SELECT m.*, rank
      FROM memory_fts f
      JOIN memory m ON m.rowid = f.rowid
      WHERE memory_fts MATCH ${input.query}
        AND m.project_id = ${input.projectID}
        AND m.time_expired IS NULL
      ORDER BY rank
      LIMIT ${input.limit}
    `)
  )
  return results
}
```

---

## 6. Phase 3：智能记忆管理

### 6.1 置信度衰减

```typescript
// 定期衰减长期未访问的记忆
export async function decay() {
  const threshold = Date.now() - 30 * 24 * 60 * 60 * 1000 // 30天
  Database.use((db) =>
    db
      .update(MemoryTable)
      .set({
        confidence: sql`MAX(0.1, confidence * 0.9)`,
      })
      .where(
        and(
          lt(MemoryTable.time_accessed, threshold),
          gt(MemoryTable.confidence, 0.1),
        ),
      )
      .run()
  )
}
```

### 6.2 冲突合并

当新记忆与旧记忆冲突时（如 "项目使用 WGS84" vs "项目使用 CGCS2000"），需要：
1. 检测语义冲突
2. 保留更新的记忆，标记旧记忆为 expired
3. 通知用户冲突已解决

### 6.3 用户管理命令

| 命令 | 功能 |
|------|------|
| `/memory` | 列出当前项目的所有记忆 |
| `/memory search <query>` | 搜索记忆 |
| `/remember <content>` | 手动添加记忆 |
| `/forget <id>` | 删除指定记忆 |
| `/forget --all` | 清除所有记忆 |

### 6.4 Web UI（可选）

集成到现有的 TUI/Web 界面，提供记忆浏览和管理。

---

## 7. 与现有代码集成点

### 7.1 文件变更清单

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `src/memory/memory.sql.ts` | **新增** | Drizzle schema |
| `src/memory/memory.ts` | **新增** | 核心 CRUD + 检索 |
| `src/memory/extract.ts` | **新增** | 记忆提取逻辑 |
| `src/memory/inject.ts` | **新增** | system prompt 注入 |
| `src/storage/schema.ts` | **修改** | 导出 MemoryTable |
| `src/session/prompt.ts` ~L654 | **修改** | 注入 MemoryInject.system() |
| `src/session/compaction.ts` | **不修改** | 通过 Bus.subscribe(Event.Compacted) 监听，无需改动 |
| `src/memory/listener.ts` | **新增** | Bus 事件订阅，监听 compaction 完成事件 |
| `src/config/config.ts` | **修改** | 新增 `memory` 配置段 |
| `migration/YYYYMMDD_memory/` | **新增** | DB migration |

### 7.2 不变更的部分

- `instruction.ts` — AGENTS.md 机制保持不变，记忆是补充而非替代
- `storage.ts` — JSON 文件存储不受影响
- Plugin hook 系统 — 利用但不修改
- 所有现有 tool — 不受影响
- TUI/App 层 — Phase 1 不涉及

### 7.3 代码风格对齐

遵守 `AGENTS.md` 的 Style Guide：
- 单词变量名：`memory`, `extract`, `inject`
- 避免 destructuring，用 dot notation
- `const` over `let`
- 早期返回，无 `else`
- snake_case for Drizzle columns
- 函数式 array 方法
- 使用 `Bun.file()` API
- 使用 `fn()` wrapper（与 session/index.ts 模式一致）

---

## 8. 配置方案

在 `Config.Info` schema 中新增 `memory` 字段：

```typescript
memory: z
  .object({
    enabled: z.boolean().optional().default(true)
      .describe("Enable automatic memory system (default: true)"),
    maxMemories: z.number().int().positive().optional().default(10)
      .describe("Maximum number of memories to inject into system prompt (default: 10)"),
    autoCapture: z.boolean().optional().default(true)
      .describe("Automatically capture memories from session compaction (default: true)"),
    categories: z.array(z.enum(["discovery", "decision", "pattern", "preference", "error", "fact"]))
      .optional()
      .describe("Memory categories to capture (default: all)"),
    retention: z.number().int().positive().optional().default(90)
      .describe("Days to retain memories before soft-expiring (default: 90)"),
  })
  .optional()
  .describe("Memory system configuration for cross-session knowledge persistence"),
```

### 配置示例

```jsonc
{
  // 使用默认配置（自动开启，无需配置）
  // 或显式配置：
  "memory": {
    "enabled": true,
    "maxMemories": 15,
    "autoCapture": true,
    "retention": 180  // 保留180天
  }
}
```

---

## 9. 数据库 Schema

### Migration SQL

```sql
-- migration/YYYYMMDDHHMMSS_add_memory/migration.sql

CREATE TABLE `memory` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL REFERENCES `project`(`id`) ON DELETE CASCADE,
  `session_id` text REFERENCES `session`(`id`) ON DELETE SET NULL,
  `category` text NOT NULL,
  `content` text NOT NULL,
  `source` text,
  `confidence` real NOT NULL DEFAULT 1.0,
  `access_count` integer NOT NULL DEFAULT 0,
  `time_created` integer NOT NULL DEFAULT (unixepoch('now') * 1000),
  `time_updated` integer NOT NULL DEFAULT (unixepoch('now') * 1000),
  `time_accessed` integer,
  `time_expired` integer
);

CREATE INDEX `memory_project_idx` ON `memory` (`project_id`);
CREATE INDEX `memory_category_idx` ON `memory` (`category`);
CREATE INDEX `memory_confidence_idx` ON `memory` (`confidence`);
```

### 生成命令

```bash
cd packages/railwise
bun run db generate --name add_memory
```

---

## 10. 关键文件清单

### Phase 1 新增文件

```
packages/railwise/src/memory/
├── memory.sql.ts        # Drizzle schema 定义
├── memory.ts            # Memory namespace: CRUD, list, relevant, touch, boost
├── extract.ts           # MemoryExtract namespace: fromCompaction, parseSections, deduplicate
├── inject.ts            # MemoryInject namespace: system()
└── listener.ts          # Bus 事件订阅：监听 SessionCompaction.Event.Compacted
```

### Phase 1 修改文件

```
packages/railwise/src/storage/schema.ts          # 加 export MemoryTable
packages/railwise/src/session/prompt.ts           # ~L654 注入 MemoryInject.system()
packages/railwise/src/config/config.ts            # Config.Info 加 memory 字段
```

**注意**：`compaction.ts` 无需修改。利用其已有的 `Bus.publish(Event.Compacted)` 事件，
在 `listener.ts` 中通过 `Bus.subscribe(SessionCompaction.Event.Compacted)` 监听。
这是更解耦的方式，符合现有 Bus 事件架构模式。

---

## 11. 验证方案

### 单元测试

```
packages/railwise/test/memory/
├── memory.test.ts       # CRUD 操作、去重逻辑
├── extract.test.ts      # compaction 摘要解析、记忆提取
└── inject.test.ts       # system prompt 注入格式
```

### 集成测试

1. 创建 session → 触发 compaction → 验证 memory 表有数据
2. 新建 session → 验证 system prompt 包含 `<project-memory>` 标签
3. 添加重复记忆 → 验证去重生效
4. 配置 `memory.enabled: false` → 验证不注入

### 手动验证

```bash
cd packages/railwise
bun run dev

# 1. 开始一个会话，做一些工作
# 2. 触发 compaction (ctrl+x, c)
# 3. 新建 session (ctrl+x, n)
# 4. 观察系统 prompt 中是否包含之前的记忆
```

### E2E 验证

1. 在测绘项目中使用 → 设置控制点坐标系 → 新会话中验证记忆
2. 使用 `/remember` 命令 → 新会话中验证手动记忆
3. 长期使用 → 验证记忆衰减和过期机制

---

## 附录 A：开发顺序

### Phase 1（MVP，约 2-3 天）

1. `memory.sql.ts` — 建表 + migration
2. `memory.ts` — CRUD + 简单排序检索
3. `extract.ts` — compaction 摘要解析
4. `inject.ts` — system prompt 注入
5. 集成到 `prompt.ts` 和 `compaction.ts`
6. 配置项 `config.ts`
7. 测试

### Phase 2（FTS5 搜索，约 1-2 天）

1. FTS5 虚拟表 + 触发器
2. 上下文感知检索
3. `/memory search` 命令

### Phase 3（智能管理，约 2-3 天）

1. 置信度衰减
2. 冲突检测
3. 用户管理命令 (`/memory`, `/remember`, `/forget`)
4. 可选 Web UI

---

## 附录 B：参考项目

| 项目 | 链接 | 借鉴点 |
|------|------|--------|
| Claude Code Memory | https://code.claude.com/docs/en/memory | 层次化记忆 + auto-memory |
| opencode-mem | https://github.com/tickernelz/opencode-mem | opencode 插件架构，向量搜索 |
| memory-mcp | dev.to/suede | 两层记忆架构，hook 系统利用 |
| coding_agent_session_search | github.com/Dicklesworthstone | 会话搜索与索引 |
