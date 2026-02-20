function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

export namespace Flag {
  export const RAILWISE_AUTO_SHARE = truthy("RAILWISE_AUTO_SHARE")
  export const RAILWISE_GIT_BASH_PATH = process.env["RAILWISE_GIT_BASH_PATH"]
  export const RAILWISE_CONFIG = process.env["RAILWISE_CONFIG"]
  export declare const RAILWISE_CONFIG_DIR: string | undefined
  export const RAILWISE_CONFIG_CONTENT = process.env["RAILWISE_CONFIG_CONTENT"]
  export const RAILWISE_DISABLE_AUTOUPDATE = truthy("RAILWISE_DISABLE_AUTOUPDATE")
  export const RAILWISE_DISABLE_PRUNE = truthy("RAILWISE_DISABLE_PRUNE")
  export const RAILWISE_DISABLE_TERMINAL_TITLE = truthy("RAILWISE_DISABLE_TERMINAL_TITLE")
  export const RAILWISE_PERMISSION = process.env["RAILWISE_PERMISSION"]
  export const RAILWISE_DISABLE_DEFAULT_PLUGINS = truthy("RAILWISE_DISABLE_DEFAULT_PLUGINS")
  export const RAILWISE_DISABLE_LSP_DOWNLOAD = truthy("RAILWISE_DISABLE_LSP_DOWNLOAD")
  export const RAILWISE_ENABLE_EXPERIMENTAL_MODELS = truthy("RAILWISE_ENABLE_EXPERIMENTAL_MODELS")
  export const RAILWISE_DISABLE_AUTOCOMPACT = truthy("RAILWISE_DISABLE_AUTOCOMPACT")
  export const RAILWISE_DISABLE_MODELS_FETCH = truthy("RAILWISE_DISABLE_MODELS_FETCH")
  export const RAILWISE_DISABLE_CLAUDE_CODE = truthy("RAILWISE_DISABLE_CLAUDE_CODE")
  export const RAILWISE_DISABLE_CLAUDE_CODE_PROMPT =
    RAILWISE_DISABLE_CLAUDE_CODE || truthy("RAILWISE_DISABLE_CLAUDE_CODE_PROMPT")
  export const RAILWISE_DISABLE_CLAUDE_CODE_SKILLS =
    RAILWISE_DISABLE_CLAUDE_CODE || truthy("RAILWISE_DISABLE_CLAUDE_CODE_SKILLS")
  export const RAILWISE_DISABLE_EXTERNAL_SKILLS =
    RAILWISE_DISABLE_CLAUDE_CODE_SKILLS || truthy("RAILWISE_DISABLE_EXTERNAL_SKILLS")
  export declare const RAILWISE_DISABLE_PROJECT_CONFIG: boolean
  export const RAILWISE_FAKE_VCS = process.env["RAILWISE_FAKE_VCS"]
  export declare const RAILWISE_CLIENT: string
  export const RAILWISE_SERVER_PASSWORD = process.env["RAILWISE_SERVER_PASSWORD"]
  export const RAILWISE_SERVER_USERNAME = process.env["RAILWISE_SERVER_USERNAME"]
  export const RAILWISE_ENABLE_QUESTION_TOOL = truthy("RAILWISE_ENABLE_QUESTION_TOOL")

  // Experimental
  export const RAILWISE_EXPERIMENTAL = truthy("RAILWISE_EXPERIMENTAL")
  export const RAILWISE_EXPERIMENTAL_FILEWATCHER = truthy("RAILWISE_EXPERIMENTAL_FILEWATCHER")
  export const RAILWISE_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("RAILWISE_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const RAILWISE_EXPERIMENTAL_ICON_DISCOVERY =
    RAILWISE_EXPERIMENTAL || truthy("RAILWISE_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const RAILWISE_ENABLE_EXA =
    truthy("RAILWISE_ENABLE_EXA") || RAILWISE_EXPERIMENTAL || truthy("RAILWISE_EXPERIMENTAL_EXA")
  export const RAILWISE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("RAILWISE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const RAILWISE_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("RAILWISE_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const RAILWISE_EXPERIMENTAL_OXFMT = RAILWISE_EXPERIMENTAL || truthy("RAILWISE_EXPERIMENTAL_OXFMT")
  export const RAILWISE_EXPERIMENTAL_LSP_TY = truthy("RAILWISE_EXPERIMENTAL_LSP_TY")
  export const RAILWISE_EXPERIMENTAL_LSP_TOOL = RAILWISE_EXPERIMENTAL || truthy("RAILWISE_EXPERIMENTAL_LSP_TOOL")
  export const RAILWISE_DISABLE_FILETIME_CHECK = truthy("RAILWISE_DISABLE_FILETIME_CHECK")
  export const RAILWISE_EXPERIMENTAL_PLAN_MODE = RAILWISE_EXPERIMENTAL || truthy("RAILWISE_EXPERIMENTAL_PLAN_MODE")
  export const RAILWISE_EXPERIMENTAL_MARKDOWN = truthy("RAILWISE_EXPERIMENTAL_MARKDOWN")
  export const RAILWISE_MODELS_URL = process.env["RAILWISE_MODELS_URL"]
  export const RAILWISE_MODELS_PATH = process.env["RAILWISE_MODELS_PATH"]

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for RAILWISE_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "RAILWISE_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("RAILWISE_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for RAILWISE_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "RAILWISE_CONFIG_DIR", {
  get() {
    return process.env["RAILWISE_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for RAILWISE_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "RAILWISE_CLIENT", {
  get() {
    return process.env["RAILWISE_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})