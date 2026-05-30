# 业务模板与 SOP 命令

RAILWISE-CLI 把常用内业流程沉淀成 SOP 命令、Skill 模板和可复用 Markdown 资产。它们适合把“每天都要做、但容易漏步骤”的工作固化下来。

## 内置 SOP 命令

| 命令 | 典型场景 |
| --- | --- |
| `/daily-report` | 监测日报、巡检日报、当日异常说明 |
| `/monthly-report` | 月报、阶段报告、业主汇总材料 |
| `/data-check` | 外业数据首检、缺测和异常值检查 |
| `/trend-analysis` | 沉降、水平位移、收敛、轴力、水位趋势分析 |
| `/emergency-response` | 预警快报、加密观测建议、处置闭环记录 |
| `/bid-prepare` | 投标技术方案、商务响应和资质矩阵 |
| `/safety-check` | 安全巡检记录、问题闭环和整改说明 |
| `/payment-reminder` | 计量支付、催款说明和结算材料整理 |

在交互式会话中输入命令名即可触发，也可以直接用自然语言描述目标，由 `chief_manager` 选择合适流程。

## Skill 内置模板

两个轨道交通业务 skill 内含可复用模板：

| Skill | 模板位置 | 用途 |
| --- | --- | --- |
| `rail-monitoring-plan` | `assets/plan-template.md` | 地铁控制保护区 / 地保监测方案 |
| `operational-monitoring` | `assets/templates/` | 运营监测方案、期报、周/月报、年度总结、预警快报、控制网报告 |

Office 文档类 skill 会把 Markdown 初稿转换成常用办公交付物：

| Skill | 输出 |
| --- | --- |
| `docx` / `docx-generation` | Word 报告、评审回复、投标技术文件 |
| `xlsx` / `excel-operations` | 监测成果表、多期对比表、统计表 |
| `pptx` | 阶段汇报、业主沟通材料 |
| `pdf` | PDF 识读、摘要、终稿归档 |

Word 终稿需要套企业模板时，优先使用 `docx-generation` 的 `referenceDoc` 路线：Markdown 先形成结构稿，再通过 Pandoc reference-doc 转成带标题、正文、表格和页眉页脚样式的 `.docx`。参考模板可使用企业自有 `.docx`，也可使用 RAILWISE fork 的 `pandoc_docx_template` 中文模板。

## 自定义位置

项目模板建议放在：

```text
.railwise/
  command/
  skill/
  template/
```

内置资源用于稳定发布，项目级资源用于客户格式、合同条款、业主模板和临时试验。项目级同名文件会覆盖内置版本。

## 编写原则

模板应该明确输入、输出和验收标准，避免把 API Key、客户敏感路径、合同全文等信息写进模板。长规范、示例和表头放到 `references/` 或 `assets/`，让 Skill 按需加载。
