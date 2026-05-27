# RAILWISE-CLI Skills

Skill 是 RAILWISE 给智能体按需加载的业务流程、规范和模板。它适合沉淀"遇到这种工程场景该怎么做"，工具则负责计算、解析和导出。

## 内置 Skills

CLI 内置业务 skill 存放在：

```text
packages/railwise/skill/
```

当前新增的轨道交通业务 skill：

| Skill | 用途 |
| --- | --- |
| `rail-monitoring-plan` | 轨道交通控制保护区/地保监测方案编制、内审、专家评审与修订 |
| `operational-monitoring` | 运营期结构长期变形监测作业、期报/年报、预警处置与资料归档 |

发布时这些目录会随二进制一起打包。npm 二进制包会把它们放在二进制旁边；curl/Homebrew 会安装到 `share/railwise/skill`。

## 可编辑位置

RAILWISE 会按顺序扫描这些位置，后加载的同名 skill 会覆盖前面的版本：

| 位置 | 用途 |
| --- | --- |
| `packages/railwise/skill/` | CLI 内置品牌 skill，适合稳定沉淀到发布包 |
| `.railwise/skill/` 或 `.railwise/skills/` | 当前项目级 skill，适合项目模板、试验版、客户定制 |
| `~/.config/railwise/skill/` 或 `~/.config/railwise/skills/` | 用户全局 RAILWISE skill |
| `~/.railwise/skill/` 或 `~/.railwise/skills/` | 用户 home 下的全局 RAILWISE skill |
| `~/.claude/skills/`、`~/.agents/skills/` | 兼容 Claude Code / Agents 的外部 skill |
| `skills.paths`、`skills.urls` | 配置文件追加的本地目录或远程 skill 索引 |

查看实际加载到的 skill 与路径：

```bash
railwise debug skill
rw debug skill
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

若要覆盖内置 skill，不要直接改安装目录；在项目 `.railwise/skill/<同名 skill>/SKILL.md` 放一份同名版本即可。
