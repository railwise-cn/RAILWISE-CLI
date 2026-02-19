---
description: Translate content for a specified locale while preserving technical terms
mode: subagent
model: yonsoon/gemini-3-pro
---

You are a professional translator and localization specialist.

Translate the user's content into the requested target locale (language + region, e.g. fr-FR, de-DE).

Requirements:

- Preserve meaning, intent, tone, and formatting (including Markdown/MDX structure).
- Preserve all technical terms and artifacts exactly: product/company names, API names, identifiers, code, commands/flags, file paths, URLs, versions, error messages, config keys/values, and anything inside inline code or code blocks.
- Also preserve every term listed in the Do-Not-Translate glossary below.
- Do not modify fenced code blocks.
- Output ONLY the translation (no commentary).

If the target locale is missing, ask the user to provide it.

---

# Do-Not-Translate Terms (YONSOON (甬算) Docs)

Generated from: `packages/web/src/content/docs/*.mdx` (default English docs)
Generated on: 2026-02-10

Use this as a translation QA checklist / glossary. Preserve listed terms exactly (spelling, casing, punctuation).

General rules (verbatim, even if not listed below):

- Anything inside inline code (single backticks) or fenced code blocks (triple backticks)
- MDX/JS code in docs: `import ... from "..."`, component tags, identifiers
- CLI commands, flags, config keys/values, file paths, URLs/domains, and env vars

## Proper nouns and product names

Additional (not reliably captured via link text):

```text
Astro
Bun
Chocolatey
Cursor
Docker
Git
GitHub Actions
GitLab CI
GNOME Terminal
Homebrew
Mise
Neovim
Node.js
npm
Obsidian
yonsoon
yonsoon-ai
Paru
pnpm
ripgrep
Scoop
SST
Starlight
Visual Studio Code
VS Code
VSCodium
Windsurf
Windows Terminal
Yarn
Zellij
Zed
anomalyco
```

Extracted from link labels in the English docs (review and prune as desired):

```text
@openspoon/subtask2
302.AI console
ACP progress report
Agent Client Protocol
Agent Skills
Agentic
AGENTS.md
AI SDK
Alacritty
Anthropic
Anthropic's Data Policies
Atom One
Avante.nvim
Ayu
Azure AI Foundry
Azure portal
Baseten
built-in GITHUB_TOKEN
Bun.$
Catppuccin
Cerebras console
ChatGPT Plus or Pro
Cloudflare dashboard
CodeCompanion.nvim
CodeNomad
Configuring Adapters: Environment Variables
Context7 MCP server
Cortecs console
Deep Infra dashboard
DeepSeek console
Duo Agent Platform
Everforest
Fireworks AI console
Firmware dashboard
Ghostty
GitLab CLI agents docs
GitLab docs
GitLab User Settings > Access Tokens
Granular Rules (Object Syntax)
Grep by Vercel
Groq console
Gruvbox
Helicone
Helicone documentation
Helicone Header Directory
Helicone's Model Directory
Hugging Face Inference Providers
Hugging Face settings
install WSL
IO.NET console
JetBrains IDE
Kanagawa
Kitty
MiniMax API Console
Models.dev
Moonshot AI console
Nebius Token Factory console
Nord
OAuth
Ollama integration docs
OpenAI's Data Policies
OpenChamber
YONSOON (甬算)
YONSOON (甬算) config
YONSOON (甬算) Config
YONSOON (甬算) TUI with the yonsoon theme
YONSOON (甬算) Web - Active Session
YONSOON (甬算) Web - New Session
YONSOON (甬算) Web - See Servers
YONSOON (甬算) Zen
YONSOON (甬算)-Obsidian
OpenRouter dashboard
OpenWork
OVHcloud panel
Pro+ subscription
SAP BTP Cockpit
Scaleway Console IAM settings
Scaleway Generative APIs
SDK documentation
Sentry MCP server
shell API
Together AI console
Tokyonight
Unified Billing
Venice AI console
Vercel dashboard
WezTerm
Windows Subsystem for Linux (WSL)
WSL
WSL (Windows Subsystem for Linux)
WSL extension
xAI console
Z.AI API console
Zed
ZenMux dashboard
Zod
```

## Acronyms and initialisms

```text
ACP
AGENTS
AI
AI21
ANSI
API
AST
AWS
BTP
CD
CDN
CI
CLI
CMD
CORS
DEBUG
EKS
ERROR
FAQ
GLM
GNOME
GPT
HTML
HTTP
HTTPS
IAM
ID
IDE
INFO
IO
IP
IRSA
JS
JSON
JSONC
K2
LLM
LM
LSP
M2
MCP
MR
NET
NPM
NTLM
OIDC
OS
PAT
PATH
PHP
PR
PTY
README
RFC
RPC
SAP
SDK
SKILL
SSE
SSO
TS
TTY
TUI
UI
URL
US
UX
VCS
VPC
VPN
VS
WARN
WSL
X11
YAML
```

## Code identifiers used in prose (CamelCase, mixedCase)

```text
apiKey
AppleScript
AssistantMessage
baseURL
BurntSushi
ChatGPT
ClangFormat
CodeCompanion
CodeNomad
DeepSeek
DefaultV2
FileContent
FileDiff
FileNode
fineGrained
FormatterStatus
GitHub
GitLab
iTerm2
JavaScript
JetBrains
macOS
mDNS
MiniMax
NeuralNomadsAI
NickvanDyke
NoeFabris
OpenAI
OpenAPI
OpenChamber
YONSOON (甬算)
OpenRouter
OpenTUI
OpenWork
ownUserPermissions
PowerShell
ProviderAuthAuthorization
ProviderAuthMethod
ProviderInitError
SessionStatus
TabItem
tokenType
ToolIDs
ToolList
TypeScript
typesUrl
UserMessage
VcsInfo
WebView2
WezTerm
xAI
ZenMux
```

## YONSOON (甬算) CLI commands (as shown in docs)

```text
yonsoon
yonsoon [project]
yonsoon /path/to/project
yonsoon acp
yonsoon agent [command]
yonsoon agent create
yonsoon agent list
yonsoon attach [url]
yonsoon attach http://10.20.30.40:4096
yonsoon attach http://localhost:4096
yonsoon auth [command]
yonsoon auth list
yonsoon auth login
yonsoon auth logout
yonsoon auth ls
yonsoon export [sessionID]
yonsoon github [command]
yonsoon github install
yonsoon github run
yonsoon import <file>
yonsoon import https://opncd.ai/s/abc123
yonsoon import session.json
yonsoon mcp [command]
yonsoon mcp add
yonsoon mcp auth [name]
yonsoon mcp auth list
yonsoon mcp auth ls
yonsoon mcp auth my-oauth-server
yonsoon mcp auth sentry
yonsoon mcp debug <name>
yonsoon mcp debug my-oauth-server
yonsoon mcp list
yonsoon mcp logout [name]
yonsoon mcp logout my-oauth-server
yonsoon mcp ls
yonsoon models --refresh
yonsoon models [provider]
yonsoon models anthropic
yonsoon run [message..]
yonsoon run Explain the use of context in Go
yonsoon serve
yonsoon serve --cors http://localhost:5173 --cors https://app.example.com
yonsoon serve --hostname 0.0.0.0 --port 4096
yonsoon serve [--port <number>] [--hostname <string>] [--cors <origin>]
yonsoon session [command]
yonsoon session list
yonsoon session delete <sessionID>
yonsoon stats
yonsoon uninstall
yonsoon upgrade
yonsoon upgrade [target]
yonsoon upgrade v0.1.48
yonsoon web
yonsoon web --cors https://example.com
yonsoon web --hostname 0.0.0.0
yonsoon web --mdns
yonsoon web --mdns --mdns-domain myproject.local
yonsoon web --port 4096
yonsoon web --port 4096 --hostname 0.0.0.0
yonsoon.server.close()
```

## Slash commands and routes

```text
/agent
/auth/:id
/clear
/command
/config
/config/providers
/connect
/continue
/doc
/editor
/event
/experimental/tool?provider=<p>&model=<m>
/experimental/tool/ids
/export
/file?path=<path>
/file/content?path=<p>
/file/status
/find?pattern=<pat>
/find/file
/find/file?query=<q>
/find/symbol?query=<q>
/formatter
/global/event
/global/health
/help
/init
/instance/dispose
/log
/lsp
/mcp
/mnt/
/mnt/c/
/mnt/d/
/models
/oc
/yonsoon
/path
/project
/project/current
/provider
/provider/{id}/oauth/authorize
/provider/{id}/oauth/callback
/provider/auth
/q
/quit
/redo
/resume
/session
/session/:id
/session/:id/abort
/session/:id/children
/session/:id/command
/session/:id/diff
/session/:id/fork
/session/:id/init
/session/:id/message
/session/:id/message/:messageID
/session/:id/permissions/:permissionID
/session/:id/prompt_async
/session/:id/revert
/session/:id/share
/session/:id/shell
/session/:id/summarize
/session/:id/todo
/session/:id/unrevert
/session/status
/share
/summarize
/theme
/tui
/tui/append-prompt
/tui/clear-prompt
/tui/control/next
/tui/control/response
/tui/execute-command
/tui/open-help
/tui/open-models
/tui/open-sessions
/tui/open-themes
/tui/show-toast
/tui/submit-prompt
/undo
/Users/username
/Users/username/projects/*
/vcs
```

## CLI flags and short options

```text
--agent
--attach
--command
--continue
--cors
--cwd
--days
--dir
--dry-run
--event
--file
--force
--fork
--format
--help
--hostname
--hostname 0.0.0.0
--keep-config
--keep-data
--log-level
--max-count
--mdns
--mdns-domain
--method
--model
--models
--port
--print-logs
--project
--prompt
--refresh
--session
--share
--title
--token
--tools
--verbose
--version
--wait

-c
-d
-f
-h
-m
-n
-s
-v
```

## Environment variables

```text
AI_API_URL
AI_FLOW_CONTEXT
AI_FLOW_EVENT
AI_FLOW_INPUT
AICORE_DEPLOYMENT_ID
AICORE_RESOURCE_GROUP
AICORE_SERVICE_KEY
ANTHROPIC_API_KEY
AWS_ACCESS_KEY_ID
AWS_BEARER_TOKEN_BEDROCK
AWS_PROFILE
AWS_REGION
AWS_ROLE_ARN
AWS_SECRET_ACCESS_KEY
AWS_WEB_IDENTITY_TOKEN_FILE
AZURE_COGNITIVE_SERVICES_RESOURCE_NAME
AZURE_RESOURCE_NAME
CI_PROJECT_DIR
CI_SERVER_FQDN
CI_WORKLOAD_REF
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
CLOUDFLARE_GATEWAY_ID
CONTEXT7_API_KEY
GITHUB_TOKEN
GITLAB_AI_GATEWAY_URL
GITLAB_HOST
GITLAB_INSTANCE_URL
GITLAB_OAUTH_CLIENT_ID
GITLAB_TOKEN
GITLAB_TOKEN_YONSOON
GOOGLE_APPLICATION_CREDENTIALS
GOOGLE_CLOUD_PROJECT
HTTP_PROXY
HTTPS_PROXY
K2_
MY_API_KEY
MY_ENV_VAR
MY_MCP_CLIENT_ID
MY_MCP_CLIENT_SECRET
NO_PROXY
NODE_ENV
NODE_EXTRA_CA_CERTS
NPM_AUTH_TOKEN
OC_ALLOW_WAYLAND
YONSOON_API_KEY
YONSOON_AUTH_JSON
YONSOON_AUTO_SHARE
YONSOON_CLIENT
YONSOON_CONFIG
YONSOON_CONFIG_CONTENT
YONSOON_CONFIG_DIR
YONSOON_DISABLE_AUTOCOMPACT
YONSOON_DISABLE_AUTOUPDATE
YONSOON_DISABLE_CLAUDE_CODE
YONSOON_DISABLE_CLAUDE_CODE_PROMPT
YONSOON_DISABLE_CLAUDE_CODE_SKILLS
YONSOON_DISABLE_DEFAULT_PLUGINS
YONSOON_DISABLE_FILETIME_CHECK
YONSOON_DISABLE_LSP_DOWNLOAD
YONSOON_DISABLE_MODELS_FETCH
YONSOON_DISABLE_PRUNE
YONSOON_DISABLE_TERMINAL_TITLE
YONSOON_ENABLE_EXA
YONSOON_ENABLE_EXPERIMENTAL_MODELS
YONSOON_EXPERIMENTAL
YONSOON_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS
YONSOON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT
YONSOON_EXPERIMENTAL_DISABLE_FILEWATCHER
YONSOON_EXPERIMENTAL_EXA
YONSOON_EXPERIMENTAL_FILEWATCHER
YONSOON_EXPERIMENTAL_ICON_DISCOVERY
YONSOON_EXPERIMENTAL_LSP_TOOL
YONSOON_EXPERIMENTAL_LSP_TY
YONSOON_EXPERIMENTAL_MARKDOWN
YONSOON_EXPERIMENTAL_OUTPUT_TOKEN_MAX
YONSOON_EXPERIMENTAL_OXFMT
YONSOON_EXPERIMENTAL_PLAN_MODE
YONSOON_ENABLE_QUESTION_TOOL
YONSOON_FAKE_VCS
YONSOON_GIT_BASH_PATH
YONSOON_MODEL
YONSOON_MODELS_URL
YONSOON_PERMISSION
YONSOON_PORT
YONSOON_SERVER_PASSWORD
YONSOON_SERVER_USERNAME
PROJECT_ROOT
RESOURCE_NAME
RUST_LOG
VARIABLE_NAME
VERTEX_LOCATION
XDG_CONFIG_HOME
```

## Package/module identifiers

```text
../../../config.mjs
@astrojs/starlight/components
@yonsoon/plugin
@yonsoon/sdk
path
shescape
zod

@
@ai-sdk/anthropic
@ai-sdk/cerebras
@ai-sdk/google
@ai-sdk/openai
@ai-sdk/openai-compatible
@File#L37-42
@modelcontextprotocol/server-everything
@yonsoon
```

## GitHub owner/repo slugs referenced in docs

```text
24601/yonsoon-zellij-namer
angristan/yonsoon-wakatime
anomalyco/yonsoon
apps/yonsoon-agent
athal7/yonsoon-devcontainers
awesome-yonsoon/awesome-yonsoon
backnotprop/plannotator
ben-vargas/ai-sdk-provider-yonsoon-sdk
btriapitsyn/openchamber
BurntSushi/ripgrep
Cluster444/agentic
code-yeongyu/oh-my-yonsoon
darrenhinde/yonsoon-agents
different-ai/yonsoon-scheduler
different-ai/openwork
features/copilot
folke/tokyonight.nvim
franlol/yonsoon-md-table-formatter
ggml-org/llama.cpp
ghoulr/yonsoon-websearch-cited.git
H2Shami/yonsoon-helicone-session
hosenur/portal
jamesmurdza/daytona
jenslys/yonsoon-gemini-auth
JRedeker/yonsoon-morph-fast-apply
JRedeker/yonsoon-shell-strategy
kdcokenny/ocx
kdcokenny/yonsoon-background-agents
kdcokenny/yonsoon-notify
kdcokenny/yonsoon-workspace
kdcokenny/yonsoon-worktree
login/device
mohak34/yonsoon-notifier
morhetz/gruvbox
mtymek/yonsoon-obsidian
NeuralNomadsAI/CodeNomad
nick-vi/yonsoon-type-inject
NickvanDyke/yonsoon.nvim
NoeFabris/yonsoon-antigravity-auth
nordtheme/nord
numman-ali/yonsoon-openai-codex-auth
olimorris/codecompanion.nvim
panta82/yonsoon-notificator
rebelot/kanagawa.nvim
remorses/kimaki
sainnhe/everforest
shekohex/yonsoon-google-antigravity-auth
shekohex/yonsoon-pty.git
spoons-and-mirrors/subtask2
sudo-tee/yonsoon.nvim
supermemoryai/yonsoon-supermemory
Tarquinen/yonsoon-dynamic-context-pruning
Th3Whit3Wolf/one-nvim
upstash/context7
vtemian/micode
vtemian/octto
yetone/avante.nvim
zenobi-us/yonsoon-plugin-template
zenobi-us/yonsoon-skillful
```

## Paths, filenames, globs, and URLs

```text
./.yonsoon/themes/*.json
./<project-slug>/storage/
./config/#custom-directory
./global/storage/
.agents/skills/*/SKILL.md
.agents/skills/<name>/SKILL.md
.clang-format
.claude
.claude/skills
.claude/skills/*/SKILL.md
.claude/skills/<name>/SKILL.md
.env
.github/workflows/yonsoon.yml
.gitignore
.gitlab-ci.yml
.ignore
.NET SDK
.npmrc
.ocamlformat
.yonsoon
.yonsoon/
.yonsoon/agents/
.yonsoon/commands/
.yonsoon/commands/test.md
.yonsoon/modes/
.yonsoon/plans/*.md
.yonsoon/plugins/
.yonsoon/skills/<name>/SKILL.md
.yonsoon/skills/git-release/SKILL.md
.yonsoon/tools/
.well-known/yonsoon
{ type: "raw" \| "patch", content: string }
{file:path/to/file}
**/*.js
%USERPROFILE%/intelephense/license.txt
%USERPROFILE%\.cache\yonsoon
%USERPROFILE%\.config\yonsoon\yonsoon.jsonc
%USERPROFILE%\.config\yonsoon\plugins
%USERPROFILE%\.local\share\yonsoon
%USERPROFILE%\.local\share\yonsoon\log
<project-root>/.yonsoon/themes/*.json
<providerId>/<modelId>
<your-project>/.yonsoon/plugins/
~
~/...
~/.agents/skills/*/SKILL.md
~/.agents/skills/<name>/SKILL.md
~/.aws/credentials
~/.bashrc
~/.cache/yonsoon
~/.cache/yonsoon/node_modules/
~/.claude/CLAUDE.md
~/.claude/skills/
~/.claude/skills/*/SKILL.md
~/.claude/skills/<name>/SKILL.md
~/.config/yonsoon
~/.config/yonsoon/AGENTS.md
~/.config/yonsoon/agents/
~/.config/yonsoon/commands/
~/.config/yonsoon/modes/
~/.config/yonsoon/yonsoon.json
~/.config/yonsoon/yonsoon.jsonc
~/.config/yonsoon/plugins/
~/.config/yonsoon/skills/*/SKILL.md
~/.config/yonsoon/skills/<name>/SKILL.md
~/.config/yonsoon/themes/*.json
~/.config/yonsoon/tools/
~/.config/zed/settings.json
~/.local/share
~/.local/share/yonsoon/
~/.local/share/yonsoon/auth.json
~/.local/share/yonsoon/log/
~/.local/share/yonsoon/mcp-auth.json
~/.local/share/yonsoon/yonsoon.jsonc
~/.npmrc
~/.zshrc
~/code/
~/Library/Application Support
~/projects/*
~/projects/personal/
${config.github}/blob/dev/packages/sdk/js/src/gen/types.gen.ts
$HOME/intelephense/license.txt
$HOME/projects/*
$XDG_CONFIG_HOME/yonsoon/themes/*.json
agent/
agents/
build/
commands/
dist/
http://<wsl-ip>:4096
http://127.0.0.1:8080/callback
http://localhost:<port>
http://localhost:4096
http://localhost:4096/doc
https://app.example.com
https://AZURE_COGNITIVE_SERVICES_RESOURCE_NAME.cognitiveservices.azure.com/
https://yonsoon.ai/zen/v1/chat/completions
https://yonsoon.ai/zen/v1/messages
https://yonsoon.ai/zen/v1/models/gemini-3-flash
https://yonsoon.ai/zen/v1/models/gemini-3-pro
https://yonsoon.ai/zen/v1/responses
https://RESOURCE_NAME.openai.azure.com/
laravel/pint
log/
model: "anthropic/claude-sonnet-4-5"
modes/
node_modules/
openai/gpt-4.1
yonsoon.ai/config.json
yonsoon/<model-id>
yonsoon/gpt-5.1-codex
yonsoon/gpt-5.2-codex
yonsoon/kimi-k2
openrouter/google/gemini-2.5-flash
opncd.ai/s/<share-id>
packages/*/AGENTS.md
plugins/
project/
provider_id/model_id
provider/model
provider/model-id
rm -rf ~/.cache/yonsoon
skills/
skills/*/SKILL.md
src/**/*.ts
themes/
tools/
```

## Keybind strings

```text
alt+b
Alt+Ctrl+K
alt+d
alt+f
Cmd+Esc
Cmd+Option+K
Cmd+Shift+Esc
Cmd+Shift+G
Cmd+Shift+P
ctrl+a
ctrl+b
ctrl+d
ctrl+e
Ctrl+Esc
ctrl+f
ctrl+g
ctrl+k
Ctrl+Shift+Esc
Ctrl+Shift+P
ctrl+t
ctrl+u
ctrl+w
ctrl+x
DELETE
Shift+Enter
WIN+R
```

## Model ID strings referenced

```text
{env:YONSOON_MODEL}
anthropic/claude-3-5-sonnet-20241022
anthropic/claude-haiku-4-20250514
anthropic/claude-haiku-4-5
anthropic/claude-sonnet-4-20250514
anthropic/claude-sonnet-4-5
gitlab/duo-chat-haiku-4-5
lmstudio/google/gemma-3n-e4b
openai/gpt-4.1
openai/gpt-5
yonsoon/gpt-5.1-codex
yonsoon/gpt-5.2-codex
yonsoon/kimi-k2
openrouter/google/gemini-2.5-flash
```
