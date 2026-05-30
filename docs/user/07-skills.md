# RAILWISE-CLI Skills 与内置资源

Skill 是 RAILWISE 给智能体按需加载的业务流程、规范和模板。它适合沉淀"遇到这种工程场景该怎么做"，工具则负责计算、解析和导出。

当前已验证发布版本 `railwise-ai@1.2.30` 会随安装包内置这些资源。安装后可用 `railwise agent list` 和 `railwise debug skill` 检查实际加载结果。

## 内置 Skills

CLI 当前内置 28 个 skill，存放在：

```text
packages/railwise/skill/
```

核心轨道交通业务 skill：

| Skill | 用途 |
| --- | --- |
| `rail-monitoring-plan` | 轨道交通控制保护区/地保监测方案编制、内审、专家评审与修订 |
| `operational-monitoring` | 运营期结构长期变形监测作业、期报/年报、预警处置与资料归档 |

常用办公与产物类 skill 也已内置：`docx`、`xlsx`、`pptx`、`pdf`、`doc-coauthoring`、`web-artifacts-builder`、`webapp-testing`、`brand-guidelines`、`theme-factory`、`mcp-builder`、`skill-creator`。

## 内置 Agents 与 Commands

CLI 内置 12 个 RAILWISE 业务智能体和 8 个 SOP 命令模板：

```text
packages/railwise/agent/
packages/railwise/command/
packages/railwise/railwise.json
```

默认主控智能体由 `packages/railwise/railwise.json` 指定为 `chief_manager`。发布时这些目录会随二进制一起打包。npm 二进制包会把它们放在平台二进制旁边；curl/Homebrew 会安装到 `share/railwise/`。

## 可编辑位置

RAILWISE 会按顺序扫描这些位置，后加载的同名资源会覆盖前面的版本：

| 位置 | 用途 |
| --- | --- |
| `packages/railwise/agent/`、`packages/railwise/command/`、`packages/railwise/skill/` | CLI 内置品牌资源，适合稳定沉淀到发布包 |
| `.railwise/agent/`、`.railwise/command/` | 当前项目级 Agent/Command 覆盖 |
| `.railwise/skill/` 或 `.railwise/skills/` | 当前项目级 skill，适合项目模板、试验版、客户定制 |
| `~/.config/railwise/skill/` 或 `~/.config/railwise/skills/` | 用户全局 RAILWISE skill |
| `~/.railwise/skill/` 或 `~/.railwise/skills/` | 用户 home 下的全局 RAILWISE skill |
| `~/.claude/skills/`、`~/.agents/skills/` | 兼容 Claude Code / Agents 的外部 skill |
| `skills.paths`、`skills.urls` | 配置文件追加的本地目录或远程 skill 索引 |

查看实际加载到的 skill 与路径：

```bash
railwise agent list
railwise debug skill
rw debug skill
railwise debug agent
rw debug agent
```

## 编辑建议

编辑 `SKILL.md` 时，frontmatter 的 `name` 和 `description` 最重要。`description` 会进入技能发现上下文，应短而准，包含触发场景；长规范、模板和案例放到 `references/` 或 `assets/`，由 skill 正文按需引用。

推荐结构：

```text
my-skill/
├── SKILL.md
├── references/
└── assets/
```

若要覆盖内置资源，不要直接改安装目录；在项目 `.railwise/skill/<同名 skill>/SKILL.md`、`.railwise/agent/<同名 agent>.md` 或 `.railwise/command/<同名 command>.md` 放一份同名版本即可。
