# 5 分钟上手 RAILWISE-CLI

本页只讲命令行版本。安装完成后，`railwise` 和 `rw` 是同一个入口；日常可以用更短的 `rw`。

## 1. 验证安装

```bash
railwise --version
rw --version
railwise agent list
```

`railwise agent list` 能看到 `chief_manager`、`data_analyst`、`technical_writer`、`qa_reviewer` 等内置业务智能体，说明多智能体资源已随安装包正确落地。

## 2. 配置模型

首次启动会进入设置向导：

```bash
railwise
```

也可以随时重新配置：

```bash
railwise setup
railwise auth login
```

新手推荐先接入智谱 GLM、DeepSeek、MiniMax 或 Kimi 等国内模型；企业用户可以把模型代理、私有模型或本地 Ollama 写入 `.railwise/railwise.json`。

## 3. 打开项目目录

在工程项目目录内启动：

```bash
cd /path/to/project
railwise
```

或直接把目录传给 CLI：

```bash
railwise /path/to/project
```

建议把原始资料放在项目目录下的 `input/` 或业务子目录，把生成物统一交给 RAILWISE 输出到 `output/`。不要让报告、表格、图纸摘要散落在原始资料旁边。

## 4. 发起一次任务

交互式会话中可以直接说：

```text
Chief，检查本周运营监测数据，判断是否有异常，并生成一份期报初稿。
```

一次性任务适合脚本或批处理：

```bash
railwise run -f data/settlement.csv "分析沉降趋势，输出主要风险点和报告结论"
rw run --agent qa_inspector "检查这批水准原始记录是否满足限差"
```

## 5. 使用内置业务能力

RAILWISE-CLI 已内置宁波睿威业务常用资源：

| 能力 | 用法 |
| --- | --- |
| 多智能体协作 | `chief_manager` 统一拆解任务，按需调度方案、数据、写作、审核等智能体 |
| 地保监测方案 | 触发 `rail-monitoring-plan` skill，用于控制保护区方案、内审和专家评审回复 |
| 运营监测流程 | 触发 `operational-monitoring` skill，用于期报、年报、预警处置和归档 |
| 常用办公文档 | `docx`、`xlsx`、`pptx`、`pdf` skill 用于识读、整理和导出交付物 |
| SOP 命令 | `/daily-report`、`/data-check`、`/trend-analysis`、`/bid-prepare` 等 |

查看完整资源：

```bash
railwise debug agent
railwise debug skill
```

## 6. 导出成果

常见输出包括 Markdown 初稿、Word 报告、Excel 成果表、PPT 汇报材料、PDF 终稿和图纸/文件摘要。默认约定是先生成 Markdown 结构稿，再由 `report_export`、`docx`、`xlsx` 等能力转换为工程人员可交付的办公文档。
