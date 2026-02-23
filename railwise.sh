#!/bin/bash
# ============================================================
# RAILWISE (甬算) — 开发模式启动脚本
# ============================================================
# 从 .env 文件加载环境变量（如果存在）
# 生产部署请使用构建后的二进制，而非此脚本
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 从 .env 加载配置（如果存在）
if [ -f "$SCRIPT_DIR/.env" ]; then
  set -a
  source "$SCRIPT_DIR/.env"
  set +a
fi

# 必需的环境变量检查
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "错误: ANTHROPIC_API_KEY 未设置"
  echo "请创建 .env 文件或设置环境变量，参考 .env.example"
  exit 1
fi

# 默认值（可通过 .env 或环境变量覆盖）
export ANTHROPIC_MODEL=${ANTHROPIC_MODEL:-claude-opus-4-6}
export ANTHROPIC_SMALL_FAST_MODEL=${ANTHROPIC_SMALL_FAST_MODEL:-claude-sonnet-4-20250514}
export RAILWISE_CONFIG_DIR=${RAILWISE_CONFIG_DIR:-$SCRIPT_DIR/.railwise}
export RAILWISE_VERSION=${RAILWISE_VERSION:-1.2.8}
export RAILWISE_CHANNEL=${RAILWISE_CHANNEL:-latest}

exec bun run --conditions=browser --cwd "$SCRIPT_DIR/packages/railwise" src/index.ts "$@"
