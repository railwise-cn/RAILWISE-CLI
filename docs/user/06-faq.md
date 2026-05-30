# 常见问题

## 为什么 Windows 安装后只有 build 和 plan，没有多智能体？

通常是安装到了旧版本、非 `railwise-ai` 包，或全局 PATH 指向了旧命令。请重新安装最新版并验证：

```bash
npm install -g railwise-ai@latest
railwise --version
rw --version
railwise agent list
```

`railwise agent list` 应能看到 `chief_manager`、`data_analyst`、`technical_writer`、`qa_reviewer` 等内置智能体。

## `railwise` 和 `rw` 有区别吗？

没有。两者指向同一个 CLI 入口。文档用 `railwise` 保持清晰，日常输入可以用 `rw`。

## npm 安装很慢怎么办？

国内网络可以临时指定镜像：

```bash
npm install -g railwise-ai@latest --registry=https://registry.npmmirror.com
```

企业内网也可以通过 GitHub Release 下载平台包，或把 npm 包同步到内部源。

## 如何更新到最新版？

```bash
railwise upgrade
npm install -g railwise-ai@latest
```

如果需要锁定当前已验证版本：

```bash
npm install -g railwise-ai@1.2.30
```

## 文件会上传吗？

RAILWISE-CLI 默认在本地读取文件，模型调用时只会发送完成任务所需的上下文。涉及客户资料、合同、图纸和监测原始数据时，建议优先使用企业模型代理、私有模型或本地模型，并在提示词中要求只抽取必要摘要。

## 内置 Skill 放在哪里？能改吗？

内置资源位于安装包内，对应仓库路径是：

```text
packages/railwise/agent/
packages/railwise/command/
packages/railwise/skill/
```

不要直接改安装目录。需要项目定制时，在项目目录放 `.railwise/agent/`、`.railwise/command/` 或 `.railwise/skill/` 的同名文件覆盖。

## 能识读和输出办公文档吗？

可以。当前内置 `docx`、`xlsx`、`pptx`、`pdf`、`docx-generation`、`excel-operations` 等 skill，用于常用办公文档的识读、整理和输出。工程报告建议先生成 Markdown 初稿，再导出 Word、Excel、PPT 或 PDF。

## 输出文件应该放哪里？

推荐统一放在项目目录的 `output/` 下：

```text
output/runs/<run_id>/
output/wiki/
output/latest
```

这样原始资料、过程稿、最终交付物和知识库不会混在一起，后续复核也更容易。
