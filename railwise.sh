#!/bin/bash
export ANTHROPIC_BASE_URL=https://api.jiekou.ai/anthropic
export ANTHROPIC_API_KEY=YOUR_API_KEY_HERE
export ANTHROPIC_MODEL=claude-opus-4-1-20250805
export ANTHROPIC_SMALL_FAST_MODEL=claude-sonnet-4-20250514
export RAILWISE_DISABLE_MODELS_FETCH=1
export RAILWISE_CONFIG_DIR=/Users/wangjiawei/CODE/RAILWISE-CLI/.railwise
export RAILWISE_VERSION=1.2.8
export RAILWISE_CHANNEL=latest
export NODE_TLS_REJECT_UNAUTHORIZED=0

exec bun run --conditions=browser --cwd /Users/wangjiawei/CODE/RAILWISE-CLI/packages/railwise src/index.ts "$@"
