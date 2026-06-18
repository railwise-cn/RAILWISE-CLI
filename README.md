# 睿威智测 RAILWISE

> Railwise AI 工程测绘多智能体系统

睿威智测 AI 工程测绘多智能体系统，面向工程测量、结构监测、地铁监测等测绘业务场景，提供从外业数据采集到内业报告生成的全流程 AI 辅助。

包含三端：

- **CLI**（`packages/railwise`）— 终端命令行 / CI 脚本入口
- **Web**（`packages/app`）— 浏览器 SPA
- **Desktop**（`railwise-desktop-app` 独立仓库）— Tauri 2 原生桌面端，支持 macOS / Windows；Linux 仅保留 CLI，不做桌面安装包

> **越用越懂你** — RAILWISE-CLI 内置[跨会话记忆系统](#跨会话记忆系统)，自动记住你的项目结构、编码习惯和工作偏好。用得越多，它就越了解你的项目，响应越精准，协作越默契——就像一个不断成长的工程搭档。

---

## RAILWISE-CLI 快速开始

本节只针对命令行版本。Desktop 和 Web 是外壳与预览入口，CLI 才是工程测绘多智能体核心。

### 安装方式

**npm（推荐，Windows / macOS / Linux）**

```bash
npm install -g railwise-ai@latest
railwise --version
rw --version
railwise agent list
```

当前 GitHub Latest 发布版本：**v1.2.31**（2026-06-10）。日常安装建议使用 `@latest`，企业内网锁版可使用 `railwise-ai@1.2.31`。

**curl 安装脚本（macOS / Linux）**

```bash
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh
railwise --version
rw --version
```

指定版本：

```bash
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh -s 1.2.31
```

**Homebrew（macOS / Linux）**

```bash
brew install railwise-cn/tap/railwise
railwise --version
rw --version
```

**GitHub Release 手动安装 CLI（二进制，离线/内网分发）**

从 [Releases](https://github.com/railwise-cn/RAILWISE-CLI/releases) 下载对应平台的 CLI 二进制包：

> 这些是 CLI 安装包，不包含 Desktop 安装包。桌面端在独立 `railwise-desktop-app` 仓库发布，Linux 不做桌面端。

| 平台                | 文件                          |
| ------------------- | ----------------------------- |
| macOS Apple Silicon | `railwise-darwin-arm64.zip`   |
| Linux x64           | `railwise-linux-x64.tar.gz`   |
| Linux ARM64         | `railwise-linux-arm64.tar.gz` |
| Windows x64         | `railwise-windows-x64.zip`    |

解压后把 `railwise`/`rw` 或 `railwise.exe`/`rw.cmd` 放入 PATH 即可。

安装完成后，`railwise` 和 `rw` 是同一个 CLI 入口。文档示例默认使用 `railwise`，日常输入可以使用更短的 `rw`。

**源码安装（开发者）**

需要 [Bun](https://bun.sh) >= 1.3.9：

```bash
git clone https://github.com/railwise-cn/RAILWISE-CLI.git
cd RAILWISE-CLI
bun install
bun run dev
```

### 更新方式

优先使用 CLI 自带更新命令：

```bash
railwise upgrade
railwise upgrade 1.2.31
railwise upgrade --method npm
```

也可以使用原安装方式更新：

```bash
npm install -g railwise-ai@latest
brew upgrade railwise
curl -fsSL https://raw.githubusercontent.com/railwise-cn/RAILWISE-CLI/dev/install.sh | sh
```

源码安装更新：

```bash
git pull origin dev
bun install
bun run dev
```

### 配置

首次启动会进入设置向导。也可以手动运行：

```bash
railwise setup
railwise auth login
```

项目级配置可放在 `.railwise/railwise.json`，完整示例见 [`.railwise/railwise.json.example`](.railwise/railwise.json.example)。

### 启动方式

**交互式 TUI（最常用）**

```bash
railwise
railwise /path/to/project
railwise --agent chief_manager
```

**一次性命令 / CI 脚本**

```bash
railwise run "检查本周监测数据并生成日报"
railwise run -f data.csv "分析沉降趋势，输出结论"
```

**启动本地服务**

```bash
railwise serve --hostname 127.0.0.1 --port 4096
```

**连接已有服务**

```bash
railwise attach http://localhost:4096
railwise run --attach http://localhost:4096 "继续整理报告"
```

**打开 Web 界面**

```bash
railwise web
```

**源码开发模式**

```bash
bun run dev
```

### 输出目录

工程交付物默认建议集中到项目本地 `output/`，避免报告、表格和图纸摘要散落在原始资料目录：

```text
output/
  runs/<run_id>/    # 单次任务的草稿、报告、表格、图表、日志
  wiki/             # 项目长期知识库
  latest            # 最近一次成果
```

---

## 模型支持

RAILWISE-CLI 支持多种模型接入方式，**包含多个国产免费模型**，无需付费即可使用：

### 免费 / 低价模型（推荐新手）

| 厂商     | 模型                                         | 免费额度             | 注册地址                                               |
| -------- | -------------------------------------------- | -------------------- | ------------------------------------------------------ |
| 智谱 GLM | `glm-4-flash-250414`、`glm-z1-flash`         | 永久免费             | [open.bigmodel.cn](https://open.bigmodel.cn)           |
| DeepSeek | `deepseek-chat`（V3.2）、`deepseek-reasoner` | 注册送 500 万 tokens | [platform.deepseek.com](https://platform.deepseek.com) |
| MiniMax  | `MiniMax-M1`、`MiniMax-T1`                   | 注册送免费额度       | [platform.minimaxi.com](https://platform.minimaxi.com) |
| Kimi     | `kimi-k2.5`、`moonshot-v1-auto`              | 注册送免费额度       | [platform.moonshot.cn](https://platform.moonshot.cn)   |

### 付费模型

| 厂商      | 模型                   | 说明         |
| --------- | ---------------------- | ------------ |
| Anthropic | Claude Opus / Sonnet   | 最强编码能力 |
| OpenAI    | GPT-4o / o3            | 通用能力强   |
| Google    | Gemini 2.5 Pro / Flash | 超长上下文   |

### 配置方式

编辑 `.railwise/railwise.json`，在 `provider` 中填入对应厂商的 API Key 即可：

```jsonc
{
  // 使用 DeepSeek 作为默认模型（免费）
  "model": "deepseek/deepseek-chat",
  "provider": {
    "deepseek": {
      "options": {
        "baseURL": "https://api.deepseek.com/v1",
        "apiKey": "sk-your-deepseek-key",
      },
    },
  },
}
```

完整配置示例见 [`.railwise/railwise.json.example`](.railwise/railwise.json.example)。

---

## Windows CLI 安装指南（零基础）

如果你从未接触过编程工具，请按以下步骤操作。全程约 10 分钟。

### 第一步：安装 Node.js

1. 打开浏览器，访问 [https://nodejs.org/zh-cn](https://nodejs.org/zh-cn)
2. 点击页面上的 **LTS（长期支持版）** 下载按钮（绿色按钮）
3. 运行下载的安装包（`node-vXX.X.X-x64.msi`），一路点「下一步」即可
4. **重要**：安装过程中如果出现「Add to PATH」选项，确保勾选 ✅

### 第二步：验证安装

1. 按 `Win + R`，输入 `cmd`，按回车打开命令提示符
2. 输入以下命令并回车：

```cmd
node --version
```

如果显示类似 `v22.x.x` 的版本号，说明安装成功。如果提示「不是内部或外部命令」，请重启电脑后再试。

### 第三步：设置国内镜像（加速下载）

在命令提示符中输入：

```cmd
npm config set registry https://registry.npmmirror.com
```

### 第四步：安装 RAILWISE-CLI

```cmd
npm install -g railwise-ai@latest
```

安装完成后，输入 `railwise` 或 `rw` 验证，同时确认内置多智能体已经随包安装：

```cmd
railwise --version
rw --version
railwise agent list
```

### 第五步：获取 API Key（免费）

RAILWISE-CLI 需要 AI 模型的 API Key 才能工作。推荐使用**免费**的智谱 GLM：

1. 打开 [open.bigmodel.cn](https://open.bigmodel.cn)，用手机号注册
2. 登录后进入「API keys」页面
3. 点击「创建 API key」，复制生成的密钥（以 `.xxx` 开头的一长串字符）

### 第六步：配置并启动

```cmd
railwise
rw
```

首次启动会进入设置向导，选择 `zhipuai` 作为 provider，粘贴你的 API Key 即可。之后也可以运行 `railwise setup` 或 `rw setup` 重新配置。

系统会自动使用免费的 `glm-4-flash` 模型。如需更强的模型，可按[模型支持](#模型支持)章节配置其他厂商。

### Windows 常用启动方式

```cmd
railwise
rw
railwise C:\Projects\Ningbo-Monitoring
railwise run "检查本周监测数据并生成日报"
railwise run -f data.csv "分析沉降趋势"
railwise serve --hostname 127.0.0.1 --port 4096
railwise attach http://localhost:4096
```

### 常见问题

**Q: 提示「railwise 不是内部或外部命令」？**

npm 全局安装目录可能不在系统 PATH 中。运行以下命令查看 npm 全局路径：

```cmd
npm config get prefix
```

将输出的路径添加到系统环境变量 PATH 中：右键「此电脑」→ 属性 → 高级系统设置 → 环境变量 → 在 Path 中新增该路径。

**Q: 安装很慢或失败？**

确认已设置国内镜像（第三步）。如果仍然很慢，可尝试：

```cmd
npm install -g railwise-ai@latest --registry=https://registry.npmmirror.com
```

**Q: 如何更新到最新版？**

```cmd
railwise upgrade
npm install -g railwise-ai@latest
```

---

## 系统架构

### 内置智能体（12 个领域专家）

安装后即内置 RAILWISE 业务智能体，不需要手工复制 `.railwise/agent`。默认主控智能体为 `chief_manager`：

| 智能体                  | 角色           | 默认模型        | 职责                                   |
| ----------------------- | -------------- | --------------- | -------------------------------------- |
| `chief_manager`         | 项目总工       | DeepSeek V4 Pro | 任务分发、并行调度、质量闸门控制       |
| `solution_architect`    | 方案设计师     | DeepSeek V4 Pro | 监测方案编制、技术路线规划             |
| `data_analyst`          | 数据分析师     | DeepSeek V4 Pro | 平差计算、变形趋势分析、预警研判       |
| `adjustment_computer`   | 平差计算专家   | DeepSeek V4 Pro | 水准网、导线网、CPIII 控制网工具化计算 |
| `cpiii_specialist`      | CPIII 专家     | DeepSeek V4 Pro | 高铁/城轨精测网复测方案与限差核查      |
| `qa_inspector`          | 外业质检员     | DeepSeek V4 Pro | 原始数据完整性与闭合差审查             |
| `qa_reviewer`           | 内业审核员     | DeepSeek V4 Pro | 报告质量终审（最高否决权）             |
| `technical_writer`      | 技术文档员     | DeepSeek V4 Pro | 监测日报/周报/月报撰写                 |
| `commercial_specialist` | 商务专员       | DeepSeek V4 Pro | 投标文件、计量支付                     |
| `norm_librarian`        | 规范资料管理员 | DeepSeek V4 Pro | 规范条文查询、引用固化、规范 Wiki 维护 |
| `source_ingestor`       | 资料入库专员   | DeepSeek V4 Pro | PDF、台账、历史成果结构化整理          |
| `knowledge_curator`     | 知识库整理员   | DeepSeek V4 Pro | 项目案例、FAQ、复盘经验沉淀            |

> 可在项目 `.railwise/agent/*.md` 中放置同名 Agent 覆盖内置版本。

### 专用工具（19 个）

#### 基础测量计算

| 工具                  | 功能                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `survey_calculator`   | 水准/导线闭合差校核、最小二乘严密平差、预警等级判定                       |
| `coord_transform`     | 高斯-克吕格正反算、七参数布尔莎坐标系转换（CGCS2000/WGS84/西安80/北京54） |
| `angle_convert`       | 角度多格式互转（度分秒/十进制度/弧度/密位/百分度）                        |
| `distance_calculator` | 全站仪测距综合归算（气象改正→斜距化平→投影改正）                          |
| `pile_stakeout`       | 极坐标放样计算、里程桩号偏距计算、批量放样点生成                          |

#### 基坑自动化监测

| 工具           | 功能                                                                       |
| -------------- | -------------------------------------------------------------------------- |
| `inclinometer` | 测斜仪深层水平位移剖面计算（A+/A-/B+/B- 读数→累计位移）、多期趋势分析      |
| `axial_force`  | 支撑轴力计算（频率/应力/力值转换、温度补偿）、多道支撑对比分析             |
| `water_level`  | 地下水位监测分析（降水效果评估、水头差计算、漏斗形态判断）、多井等值线数据 |

#### 变形监测分析

| 工具               | 功能                                         |
| ------------------ | -------------------------------------------- |
| `deformation_rate` | 变形速率分析、线性回归趋势预测、多测点对比   |
| `cross_section`    | 隧道收敛量计算、断面超欠挖分析、建筑限界检查 |

#### 控制网与平差

| 工具               | 功能                                                            |
| ------------------ | --------------------------------------------------------------- |
| `control_network`  | 平面控制网严密平差（间接平差法、误差椭圆）、网形设计与精度预估  |
| `cpiii_adjustment` | CPIII 自由测站后方交会、轨道控制网整网平差（平面+高程联合平差） |

#### 盾构导向测量

| 工具              | 功能                                                                     |
| ----------------- | ------------------------------------------------------------------------ |
| `shield_guidance` | 盾构机姿态解算（方位角/俯仰角/偏差）、偏差趋势分析、管片选型与拼装角计算 |

#### 数据处理与输出

| 工具              | 功能                                  |
| ----------------- | ------------------------------------- |
| `monitoring_csv`  | 自动化监测 CSV 海量数据清洗与统计     |
| `format_parser`   | 徕卡 GSI-8/GSI-16 及 DAT 格式文件解析 |
| `chart_generator` | SVG 趋势折线图生成（多测点 + 报警线） |
| `report_export`   | Markdown 转 DOCX 报告导出             |
| `standard_query`  | 工程规范/标准条文智能查询             |

### 领域技能包（28 个）

技能包（Skill）是注入 AI 上下文的专业知识文档，教会智能体"遇到这种场景该怎么做"。与工具互补——**技能教方法，工具做执行**。

| 技能                                       | 用途                                                       |
| ------------------------------------------ | ---------------------------------------------------------- |
| `report-writing`                           | 监测报告编制规范：行文原则、日报/总结报告结构、术语对照    |
| `data-analysis`                            | 平差与变形分析：计算流程、趋势拟合、收敛判断、预警分级     |
| `bidding-knowledge`                        | 投标文件编制：评分办法、资质响应、报价策略                 |
| `standard-reference`                       | 工程规范速查：GB 50911/GB 50026/JGJ 8 条文索引             |
| `monitoring-design`                        | 监测方案设计：测点布设、仪器选型、频率与报警值             |
| `bun-file-io`                              | 文件操作：Bun 运行时文件读写最佳实践                       |
| `docx-generation`                          | Word 导出：Markdown→DOCX 映射、报告模板、命名规范          |
| `excel-operations`                         | Excel 导出：Sheet 结构、标准列格式、多期对比表             |
| `humanizer`                                | 报告润色：消除 AI 痕迹、注入工程判断、句式变化             |
| `frontend-design`                          | 前端 UI：监测平台界面规范、预警四色体系、看板布局          |
| `canvas-design`                            | 图表设计：趋势图配色、坐标轴规范、剖面图构造               |
| `rail-monitoring-plan`                     | 地保监测方案：控制保护区监测方案编制、内审、专家评审与修订 |
| `operational-monitoring`                   | 运营监测：长期变形监测作业、期报/年报、预警处置与归档      |
| `docx` / `xlsx` / `pptx` / `pdf`           | 常用办公文档识读、编辑和输出                               |
| `doc-coauthoring`                          | 多人协作文档审阅、修改和交付                               |
| `webapp-testing` / `web-artifacts-builder` | Web 工具、看板和测试型产物构建                             |
| `brand-guidelines` / `theme-factory`       | 品牌规范和主题系统                                         |
| `mcp-builder` / `skill-creator`            | MCP 与 skill 开发                                          |

需要“套 Word 模板”“参考企业模板导出”时，`docx-generation` 会优先走 `referenceDoc` + Pandoc 路线；模板可使用企业自有 `.docx`，也可使用 RAILWISE fork 的 `pandoc_docx_template` 中文参考模板。

内置资源位于 `packages/railwise/agent/`、`packages/railwise/command/`、`packages/railwise/skill/`；项目级同名资源可在 `.railwise/` 下覆盖。更多编辑方式见 [`docs/user/07-skills.md`](docs/user/07-skills.md)。

### 业务命令（SOP 工作流）

| 命令                  | 用途                       |
| --------------------- | -------------------------- |
| `/daily-report`       | 监测日报生成               |
| `/monthly-report`     | 监测月报 / 阶段报告        |
| `/data-check`         | 外业数据质检               |
| `/trend-analysis`     | 沉降、位移、收敛等趋势分析 |
| `/emergency-response` | 预警、报警和应急处置快报   |
| `/bid-prepare`        | 投标文件编制               |
| `/safety-check`       | 安全巡检记录               |
| `/payment-reminder`   | 计量支付催款               |

---

## 飞书集成

RAILWISE-CLI 支持一键接入飞书/Lark 平台，通过飞书官方 MCP（`@larksuiteoapi/lark-mcp`）实现 AI 智能体与飞书办公生态的深度联动：

- **云文档读取** — 直接读取飞书云文档内容，作为专业知识补充
- **知识库检索** — 搜索和读取知识库（包括有权限的企业公开知识库）
- **多维表格** — 自动创建和管理飞书多维表格，写入监测数据、生成统计表
- **即时消息** — 向群聊或个人发送消息通知（如预警通报）
- **日历 & 任务** — 创建日程和任务，与项目管理流程联动

### 快速接入

```bash
railwise feishu
```

按引导输入飞书应用凭证（App ID + App Secret），选择需要的功能模块即可。配置自动写入 `railwise.json`，无需手动编辑。

> 飞书应用创建：访问 [open.feishu.cn](https://open.feishu.cn) → 控制台 → 创建应用 → 获取 App ID 和 App Secret → 为应用添加所需 API 权限

---

## 项目结构

```
RAILWISE-CLI/
├── .railwise/                  # RAILWISE Agent Pack（智能体、技能、工具、命令）
│   ├── agent/                  # 智能体 prompt 定义
│   ├── command/                # SOP 命令模板
│   ├── skill/                  # 业务技能包
│   ├── tool/                   # TypeScript 自定义工具
│   ├── lib/                    # Agent Pack 工具共享代码
│   ├── templates/              # 报告、方案、PPT 等模板定义
│   ├── themes/                 # TUI / Web 主题
│   └── railwise.json           # 运行时配置（API 密钥，需自行创建）
├── packages/
│   ├── railwise/               # Core + CLI 核心引擎
│   │   ├── agent/              # 内置 RAILWISE 业务智能体
│   │   ├── command/            # 内置 SOP 命令模板
│   │   └── skill/              # 内置技能包
│   ├── nb-railwise/            # 插件 SDK（工具开发 API）
│   ├── sdk/js/                 # Core HTTP/SSE SDK
│   ├── app/                    # 共享 Web UI shell / 浏览器 SPA
│   ├── ui/                     # 共享 UI 组件与设计令牌
│   ├── web/                    # 文档站
│   └── ...
└── package.json                # Bun monorepo
```

Desktop 源码、Tauri 配置、安装包、签名、公证和自动更新流程不在本仓库；桌面端在独立 `railwise-desktop-app` 仓库维护，并消费本仓库发布后的 CLI sidecar、SDK 和共享包。

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

RAILWISE-CLI 内置跨会话记忆系统——**用得越多越顺手**。系统自动从每次会话中提取关键知识（项目发现、技术决策、工作模式、踩坑经验），持久化到本地数据库。每次开启新会话时，这些记忆会自动注入上下文，让 AI 从第一句话就理解你的项目背景，无需反复解释。

随着使用积累，高频被验证的记忆会自动提升优先级，低价值的逐渐淡出——就像一个真正在成长的工程助手，越来越懂你的项目、你的习惯、你的偏好。

### 工作原理

1. **自动提取** — 当会话触发压缩（compaction）时，系统自动解析摘要中的 `## Discoveries`、`## Goal`、`## Instructions`、`## Accomplished` 等章节，提取有价值的记忆条目
2. **去重 & 增强** — 使用 Jaccard 相似度算法检测重复记忆（阈值 0.7），重复条目自动提升置信度而非重复存储
3. **智能注入** — 新会话启动时，按置信度排序取 Top-N 条记忆，以 `<project-memory>` 标签注入系统提示词
4. **生命周期管理** — 支持记忆过期、置信度衰减、访问计数跟踪

### 配置

在 `.railwise/railwise.json` 中添加 `memory` 字段：

```jsonc
{
  "memory": {
    "enabled": true, // 启用/禁用记忆系统（默认: true）
    "autoCapture": true, // 自动从压缩摘要提取（默认: true）
    "maxMemories": 10, // 注入系统提示词的最大记忆数（默认: 10，范围: 1-50）
  },
}
```

### 记忆类别

| 类别         | 说明                         | 来源              |
| ------------ | ---------------------------- | ----------------- |
| `discovery`  | 关于项目结构、文件位置的发现 | `## Discoveries`  |
| `decision`   | 项目目标与关键决策           | `## Goal`         |
| `pattern`    | 编码风格与工作流模式         | `## Instructions` |
| `fact`       | 已完成的工作成果             | `## Accomplished` |
| `preference` | 用户偏好                     | 未来扩展          |
| `error`      | 踩坑与解决方案               | 未来扩展          |

---

## 致谢

本项目基于 [opencode](https://github.com/sst/opencode)（MIT 协议）构建，感谢 SST 团队的开源贡献。

## 许可

MIT
