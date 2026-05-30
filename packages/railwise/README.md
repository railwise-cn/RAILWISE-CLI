# RAILWISE-CLI

`railwise-ai` is the npm package for **睿威智测 RAILWISE CLI**, a surveying and rail-transit monitoring multi-agent command-line system.

## Install

```bash
npm install -g railwise-ai@latest
railwise --version
rw --version
railwise agent list
```

`railwise` and `rw` are the same CLI entry. Current verified public release: **v1.2.30**.

## Start

```bash
railwise
rw
railwise /path/to/project
railwise run "检查本周监测数据并生成日报"
railwise run -f data.csv "分析沉降趋势，输出结论"
```

## Built-In Business Kit

The package ships RAILWISE resources with the platform binary:

- 12 domain agents, including `chief_manager`, `source_ingestor`, `data_analyst`, `technical_writer`, `qa_reviewer`, `qa_inspector`, `norm_librarian`, `cpiii_specialist`, and `commercial_specialist`.
- 28 skills, including `rail-monitoring-plan`, `operational-monitoring`, `docx`, `xlsx`, `pptx`, `pdf`, `docx-generation`, `excel-operations`, and `report-writing`.
- SOP commands such as `/daily-report`, `/monthly-report`, `/data-check`, `/trend-analysis`, `/emergency-response`, `/bid-prepare`, `/safety-check`, and `/payment-reminder`.

Use these commands to inspect the actual loaded paths:

```bash
railwise debug agent
railwise debug skill
```

Generated deliverables should stay under the project `output/` tree:

```text
output/runs/<run_id>/
output/wiki/
output/latest
```

## Update

```bash
railwise upgrade
npm install -g railwise-ai@latest
```

Pin a verified release when needed:

```bash
npm install -g railwise-ai@1.2.30
```

## Development

From the monorepo root:

```bash
bun install
cd packages/railwise
bun run dev
```

Do not run package tests from the monorepo root. Enter the relevant package directory first.
