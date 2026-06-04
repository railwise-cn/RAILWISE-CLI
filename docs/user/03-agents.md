# 内置多智能体

RAILWISE-CLI 当前内置 12 个工程测绘业务智能体，默认由 `chief_manager` 作为 RAILWISE 协作入口统一调度。安装后无需手工复制 `.railwise/agent`，npm、curl、Homebrew 和 GitHub Release 包都会随 CLI 带上这些资源。

## 智能体清单

| 智能体 | 角色 | 主要职责 |
| --- | --- | --- |
| `chief_manager` | RAILWISE 协作入口 | 拆解任务、安排协作顺序、控制质量闸门 |
| `source_ingestor` | 资料入库专员 | 识别项目资料、整理输入清单、发现缺失文件 |
| `knowledge_curator` | 知识库整理员 | 沉淀项目 FAQ、案例、复盘和 Wiki 页面 |
| `solution_architect` | 方案设计师 | 监测方案、技术路线、测点布设和工作量估算 |
| `technical_writer` | 技术文档员 | 日报、周报、月报、总结报告和投标技术文本 |
| `qa_reviewer` | 内业审核员 | 交付前终审、规范合规、数值和口径一致性检查 |
| `data_analyst` | 数据分析师 | 平差、趋势分析、变形速率和预警研判 |
| `adjustment_computer` | 平差计算专家 | 水准网、导线网、控制网和 CPIII 计算 |
| `commercial_specialist` | 商务专员 | 投标响应、报价说明、计量支付和合同风险 |
| `cpiii_specialist` | CPIII 专家 | 高铁/城轨精测网、自由测站和限差核查 |
| `norm_librarian` | 规范资料管理员 | 标准条文查询、引用固化和规范 Wiki 维护 |
| `qa_inspector` | 外业质检员 | 原始数据完整性、闭合差、观测条件和返工判断 |

## 查看与选择

```bash
railwise agent list
railwise --agent chief_manager
railwise run --agent data_analyst "校核这批沉降数据"
```

日常建议从 `chief_manager` 开始，让 RAILWISE 根据任务自动调度；只有在明确知道要找哪个角色时，再直接指定专业智能体。

## 项目级覆盖

不要直接修改安装目录里的内置 Agent。需要客户项目定制时，在项目目录放同名文件即可覆盖：

```text
.railwise/
  agent/
    chief_manager.md
    technical_writer.md
```

这样既能保留 RAILWISE 品牌默认能力，又能为具体项目调整口径、模板和交付标准。
