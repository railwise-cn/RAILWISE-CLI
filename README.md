# RAILWISE-CLI

睿威智测 AI 工程测绘多智能体 CLI 系统。

基于 [opencode](https://github.com/sst/opencode) 深度定制，面向工程测量、结构监测、地铁监测等测绘业务场景，提供从外业数据采集到内业报告生成的全流程 AI 辅助。

---

## 快速开始

### 环境要求

- [Bun](https://bun.sh) >= 1.3.9
- API 密钥（支持多种模型，含国产免费模型）

### 安装

```bash
git clone https://github.com/railwise-cn/RAILWISE-CLI.git
cd RAILWISE-CLI
bun install

# 注册全局命令（只需执行一次）
cd packages/railwise && bun link && cd ../..

# 配置 API 密钥
cp .railwise/railwise.jsonc.example .railwise/railwise.jsonc
# 编辑 .railwise/railwise.jsonc，填入你的 API Key
```

### 启动

注册全局命令后，在任意目录下直接运行：

```bash
railwise
```

也可以在项目根目录使用开发模式：

```bash
bun run dev
```

---

## 模型支持

RAILWISE-CLI 支持多种模型接入方式，**包含多个国产免费模型**，无需付费即可使用：

### 免费 / 低价模型（推荐新手）

| 厂商 | 模型 | 免费额度 | 注册地址 |
|------|------|----------|----------|
| 智谱 GLM | `glm-4-flash-250414`、`glm-z1-flash` | 永久免费 | [open.bigmodel.cn](https://open.bigmodel.cn) |
| DeepSeek | `deepseek-chat`（V3.2）、`deepseek-reasoner` | 注册送 500 万 tokens | [platform.deepseek.com](https://platform.deepseek.com) |
| MiniMax | `MiniMax-M1`、`MiniMax-T1` | 注册送免费额度 | [platform.minimaxi.com](https://platform.minimaxi.com) |
| Kimi | `moonshot-v1-auto`、`kimi-k2` | 注册送免费额度 | [platform.moonshot.cn](https://platform.moonshot.cn) |

### 付费模型

| 厂商 | 模型 | 说明 |
|------|------|------|
| Anthropic | Claude Opus / Sonnet | 最强编码能力 |
| OpenAI | GPT-4o / o3 | 通用能力强 |
| Google | Gemini 2.5 Pro / Flash | 超长上下文 |

### 配置方式

编辑 `.railwise/railwise.jsonc`，在 `provider` 中填入对应厂商的 API Key 即可：

```jsonc
{
  // 使用 DeepSeek 作为默认模型（免费）
  "model": "deepseek/deepseek-chat",
  "provider": {
    "deepseek": {
      "options": {
        "baseURL": "https://api.deepseek.com/v1",
        "apiKey": "sk-your-deepseek-key"
      }
    }
  }
}
```

完整配置示例见 [`.railwise/railwise.jsonc.example`](.railwise/railwise.jsonc.example)。

---

## 系统架构

### 自定义智能体（7 个领域专家）

| 智能体 | 角色 | 职责 |
|--------|------|------|
| `chief_manager` | 项目总工 | 任务分发与流程调度 |
| `solution_architect` | 方案设计师 | 监测方案编制、技术路线规划 |
| `data_analyst` | 数据分析师 | 平差计算、变形趋势分析、预警研判 |
| `qa_inspector` | 外业质检员 | 原始数据完整性与闭合差审查 |
| `qa_reviewer` | 内业审核员 | 报告质量终审 |
| `technical_writer` | 技术文档员 | 监测日报/周报/月报撰写 |
| `commercial_specialist` | 商务专员 | 投标文件、计量支付 |

### 专用工具（24 个）

#### 基础测量计算

| 工具 | 功能 |
|------|------|
| `survey_calculator` | 水准/导线闭合差校核、最小二乘严密平差、预警等级判定 |
| `coord_transform` | 高斯-克吕格正反算、七参数布尔莎坐标系转换（CGCS2000/WGS84/西安80/北京54） |
| `angle_convert` | 角度多格式互转（度分秒/十进制度/弧度/密位/百分度） |
| `distance_calculator` | 全站仪测距综合归算（气象改正→斜距化平→投影改正） |
| `pile_stakeout` | 极坐标放样计算、里程桩号偏距计算、批量放样点生成 |

#### 基坑自动化监测

| 工具 | 功能 |
|------|------|
| `inclinometer` | 测斜仪深层水平位移剖面计算（A+/A-/B+/B- 读数→累计位移）、多期趋势分析 |
| `axial_force` | 支撑轴力计算（频率/应力/力值转换、温度补偿）、多道支撑对比分析 |
| `water_level` | 地下水位监测分析（降水效果评估、水头差计算、漏斗形态判断）、多井等值线数据 |

#### 变形监测分析

| 工具 | 功能 |
|------|------|
| `deformation_rate` | 变形速率分析、线性回归趋势预测、多测点对比 |
| `cross_section` | 隧道收敛量计算、断面超欠挖分析、建筑限界检查 |

#### 控制网与平差

| 工具 | 功能 |
|------|------|
| `control_network` | 平面控制网严密平差（间接平差法、误差椭圆）、网形设计与精度预估 |
| `cpiii_adjustment` | CPIII 自由测站后方交会、轨道控制网整网平差（平面+高程联合平差） |

#### 盾构导向测量

| 工具 | 功能 |
|------|------|
| `shield_guidance` | 盾构机姿态解算（方位角/俯仰角/偏差）、偏差趋势分析、管片选型与拼装角计算 |

#### 数据处理与输出

| 工具 | 功能 |
|------|------|
| `monitoring_csv` | 自动化监测 CSV 海量数据清洗与统计 |
| `format_parser` | 徕卡 GSI-8/GSI-16 及 DAT 格式文件解析 |
| `chart_generator` | SVG 趋势折线图生成（多测点 + 报警线） |
| `report_export` | Markdown 转 DOCX 报告导出 |
| `standard_query` | 工程规范/标准条文智能查询 |

### 业务命令（SOP 工作流）

| 命令 | 用途 |
|------|------|
| `/daily-report` | 监测日报生成 |
| `/data-check` | 外业数据质检 |
| `/bid-prepare` | 投标文件编制 |
| `/safety-check` | 安全巡检记录 |
| `/payment-reminder` | 计量支付催款 |

---

## 项目结构

```
RAILWISE-CLI/
├── .railwise/                  # 自定义配置（智能体、工具、命令）
│   ├── agent/                  # 智能体 prompt 定义
│   ├── tool/                   # TypeScript 自定义工具
│   ├── command/                # SOP 命令模板
│   └── railwise.jsonc          # 运行时配置（API 密钥，需自行创建）
├── packages/
│   ├── railwise/               # CLI 核心引擎
│   ├── nb-railwise/            # 插件 SDK（工具开发 API）
│   ├── app/                    # TUI 前端
│   ├── desktop/                # 桌面端（开发中）
│   └── ...
└── package.json                # Bun monorepo
```

## 插件开发

自定义工具使用 `nb-railwise` SDK 开发，放置于 `.railwise/tool/` 目录即可自动加载：

```typescript
/// <reference path="../env.d.ts" />
import { tool } from "nb-railwise/tool"

export default tool({
  description: "工具描述",
  args: {
    input: tool.schema.string().describe("参数说明"),
  },
  async execute(args) {
    // 实现逻辑
    return JSON.stringify({ result: "..." })
  },
})
```

---

## 跨会话记忆系统

RAILWISE-CLI 内置跨会话记忆系统，自动从会话压缩摘要中提取关键知识（发现、决策、模式、事实），持久化到 SQLite 数据库，并在新会话启动时注入系统提示词。

### 工作原理

1. **自动提取** — 当会话触发压缩（compaction）时，系统自动解析摘要中的 `## Discoveries`、`## Goal`、`## Instructions`、`## Accomplished` 等章节，提取有价值的记忆条目
2. **去重 & 增强** — 使用 Jaccard 相似度算法检测重复记忆（阈值 0.7），重复条目自动提升置信度而非重复存储
3. **智能注入** — 新会话启动时，按置信度排序取 Top-N 条记忆，以 `<project-memory>` 标签注入系统提示词
4. **生命周期管理** — 支持记忆过期、置信度衰减、访问计数跟踪

### 配置

在 `.railwise/railwise.jsonc` 中添加 `memory` 字段：

```jsonc
{
  "memory": {
    "enabled": true,          // 启用/禁用记忆系统（默认: true）
    "autoCapture": true,      // 自动从压缩摘要提取（默认: true）
    "maxMemories": 10         // 注入系统提示词的最大记忆数（默认: 10，范围: 1-50）
  }
}
```

### 记忆类别

| 类别 | 说明 | 来源 |
|------|------|------|
| `discovery` | 关于项目结构、文件位置的发现 | `## Discoveries` |
| `decision` | 项目目标与关键决策 | `## Goal` |
| `pattern` | 编码风格与工作流模式 | `## Instructions` |
| `fact` | 已完成的工作成果 | `## Accomplished` |
| `preference` | 用户偏好 | 未来扩展 |
| `error` | 踩坑与解决方案 | 未来扩展 |

---

## 致谢

本项目基于 [opencode](https://github.com/sst/opencode)（MIT 协议）构建，感谢 SST 团队的开源贡献。

## 许可

MIT
