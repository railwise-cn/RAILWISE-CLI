# 内置智能体

RAILWISE Desktop 内置 13 个工程测绘子智能体，统一由 Agent Studio 管理。进入“智能体编排台”后可以查看、编辑、保存提示词，保存后会热更新到后续会话。

| 智能体              | 用途                                 |
| ------------------- | ------------------------------------ |
| chief_manager       | 总协调，拆分工程任务并分配给子智能体 |
| qa_inspector        | 外业数据首检、异常值和缺测检查       |
| survey_analyst      | 测量数据趋势分析、沉降和位移判断     |
| cad_drafter         | CAD/DXF 图层理解和图纸说明生成       |
| ppt_master          | 项目汇报 PPT 结构与内容生成          |
| report_writer       | 周报、月报、验收报告草拟             |
| compliance_reviewer | 合规条款、成果完整性和格式审查       |
| data_cleaner        | CSV/XLSX 清洗、字段规范化            |
| risk_monitor        | 项目风险、阈值和告警解释             |
| workflow_planner    | 多智能体工作流编排                   |
| field_assistant     | 外业记录整理和补录建议               |
| archive_keeper      | 成果归档、命名和目录建议             |
| client_briefing     | 面向业主的简明汇报口径               |

编辑智能体时，只修改职责、输入输出和工具边界。不要把 API Key、客户敏感信息或私有路径写进提示词。
