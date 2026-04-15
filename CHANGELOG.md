# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-04-08

### Added

#### Parallel Agent System
- `parallel_agent` tool for true multi-agent parallel execution
- Independent sessions with permission isolation per subtask
- Failure isolation (single task failure doesn't affect others)
- Error aggregation with Markdown-formatted output

#### PPT Master Integration
- `ppt_master` agent for AI-powered presentation generation
- SVG page design → PPTX export pipeline
- Multi-format support: PPT 16:9, PPT 4:3, 小红书, 朋友圈, Story, 公众号头图
- Execution discipline enforcement (serial page generation, immediate write)
- Topic research workflow for source-less generation
- Tabler Icons upgrade

#### Domain Agent Templates
- `settlement.md` - 水准沉降监测专家
- `shield.md` - 盾构导向测量专家
- `excavation.md` - 深基坑监测专家
- `tunnel.md` - 隧道收敛监测专家
- `control.md` - 控制网平差专家

#### Agent Capabilities
- All agents updated with parallel dispatch strategy
- Chief Manager: multi-agent coordination and quality gate control
- New tools integrated: SVG generation, chart creation, report export

### Changed

- Agent prompts optimized for multi-agent collaboration
- Parallel dispatch strategy documented in chief_manager.md
- Upstream sync: provider API, session UI, bun config

### Fixed

- ESM compatibility for bin/railwise
- `rw` alias properly configured

### Documentation

- README.md updated with new features:
  - Parallel agent system
  - PPT Master section
  - 8 agents (added ppt_master)
  - 12 skills (added ppt-master)
- docs/UPGRADE-PLAN.md tracking implementation progress

## [1.2.8] - 2026-03-24

### Previous Release

See git history for details.
