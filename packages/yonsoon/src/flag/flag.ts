function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

export namespace Flag {
  export const YONSOON_AUTO_SHARE = truthy("YONSOON_AUTO_SHARE")
  export const YONSOON_GIT_BASH_PATH = process.env["YONSOON_GIT_BASH_PATH"]
  export const YONSOON_CONFIG = process.env["YONSOON_CONFIG"]
  export declare const YONSOON_CONFIG_DIR: string | undefined
  export const YONSOON_CONFIG_CONTENT = process.env["YONSOON_CONFIG_CONTENT"]
  export const YONSOON_DISABLE_AUTOUPDATE = truthy("YONSOON_DISABLE_AUTOUPDATE")
  export const YONSOON_DISABLE_PRUNE = truthy("YONSOON_DISABLE_PRUNE")
  export const YONSOON_DISABLE_TERMINAL_TITLE = truthy("YONSOON_DISABLE_TERMINAL_TITLE")
  export const YONSOON_PERMISSION = process.env["YONSOON_PERMISSION"]
  export const YONSOON_DISABLE_DEFAULT_PLUGINS = truthy("YONSOON_DISABLE_DEFAULT_PLUGINS")
  export const YONSOON_DISABLE_LSP_DOWNLOAD = truthy("YONSOON_DISABLE_LSP_DOWNLOAD")
  export const YONSOON_ENABLE_EXPERIMENTAL_MODELS = truthy("YONSOON_ENABLE_EXPERIMENTAL_MODELS")
  export const YONSOON_DISABLE_AUTOCOMPACT = truthy("YONSOON_DISABLE_AUTOCOMPACT")
  export const YONSOON_DISABLE_MODELS_FETCH = truthy("YONSOON_DISABLE_MODELS_FETCH")
  export const YONSOON_DISABLE_CLAUDE_CODE = truthy("YONSOON_DISABLE_CLAUDE_CODE")
  export const YONSOON_DISABLE_CLAUDE_CODE_PROMPT =
    YONSOON_DISABLE_CLAUDE_CODE || truthy("YONSOON_DISABLE_CLAUDE_CODE_PROMPT")
  export const YONSOON_DISABLE_CLAUDE_CODE_SKILLS =
    YONSOON_DISABLE_CLAUDE_CODE || truthy("YONSOON_DISABLE_CLAUDE_CODE_SKILLS")
  export const YONSOON_DISABLE_EXTERNAL_SKILLS =
    YONSOON_DISABLE_CLAUDE_CODE_SKILLS || truthy("YONSOON_DISABLE_EXTERNAL_SKILLS")
  export declare const YONSOON_DISABLE_PROJECT_CONFIG: boolean
  export const YONSOON_FAKE_VCS = process.env["YONSOON_FAKE_VCS"]
  export declare const YONSOON_CLIENT: string
  export const YONSOON_SERVER_PASSWORD = process.env["YONSOON_SERVER_PASSWORD"]
  export const YONSOON_SERVER_USERNAME = process.env["YONSOON_SERVER_USERNAME"]
  export const YONSOON_ENABLE_QUESTION_TOOL = truthy("YONSOON_ENABLE_QUESTION_TOOL")

  // Experimental
  export const YONSOON_EXPERIMENTAL = truthy("YONSOON_EXPERIMENTAL")
  export const YONSOON_EXPERIMENTAL_FILEWATCHER = truthy("YONSOON_EXPERIMENTAL_FILEWATCHER")
  export const YONSOON_EXPERIMENTAL_DISABLE_FILEWATCHER = truthy("YONSOON_EXPERIMENTAL_DISABLE_FILEWATCHER")
  export const YONSOON_EXPERIMENTAL_ICON_DISCOVERY =
    YONSOON_EXPERIMENTAL || truthy("YONSOON_EXPERIMENTAL_ICON_DISCOVERY")

  const copy = process.env["YONSOON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
  export const YONSOON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT =
    copy === undefined ? process.platform === "win32" : truthy("YONSOON_EXPERIMENTAL_DISABLE_COPY_ON_SELECT")
  export const YONSOON_ENABLE_EXA =
    truthy("YONSOON_ENABLE_EXA") || YONSOON_EXPERIMENTAL || truthy("YONSOON_EXPERIMENTAL_EXA")
  export const YONSOON_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS = number("YONSOON_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS")
  export const YONSOON_EXPERIMENTAL_OUTPUT_TOKEN_MAX = number("YONSOON_EXPERIMENTAL_OUTPUT_TOKEN_MAX")
  export const YONSOON_EXPERIMENTAL_OXFMT = YONSOON_EXPERIMENTAL || truthy("YONSOON_EXPERIMENTAL_OXFMT")
  export const YONSOON_EXPERIMENTAL_LSP_TY = truthy("YONSOON_EXPERIMENTAL_LSP_TY")
  export const YONSOON_EXPERIMENTAL_LSP_TOOL = YONSOON_EXPERIMENTAL || truthy("YONSOON_EXPERIMENTAL_LSP_TOOL")
  export const YONSOON_DISABLE_FILETIME_CHECK = truthy("YONSOON_DISABLE_FILETIME_CHECK")
  export const YONSOON_EXPERIMENTAL_PLAN_MODE = YONSOON_EXPERIMENTAL || truthy("YONSOON_EXPERIMENTAL_PLAN_MODE")
  export const YONSOON_EXPERIMENTAL_MARKDOWN = truthy("YONSOON_EXPERIMENTAL_MARKDOWN")
  export const YONSOON_MODELS_URL = process.env["YONSOON_MODELS_URL"]
  export const YONSOON_MODELS_PATH = process.env["YONSOON_MODELS_PATH"]

  function number(key: string) {
    const value = process.env[key]
    if (!value) return undefined
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }
}

// Dynamic getter for YONSOON_DISABLE_PROJECT_CONFIG
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "YONSOON_DISABLE_PROJECT_CONFIG", {
  get() {
    return truthy("YONSOON_DISABLE_PROJECT_CONFIG")
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for YONSOON_CONFIG_DIR
// This must be evaluated at access time, not module load time,
// because external tooling may set this env var at runtime
Object.defineProperty(Flag, "YONSOON_CONFIG_DIR", {
  get() {
    return process.env["YONSOON_CONFIG_DIR"]
  },
  enumerable: true,
  configurable: false,
})

// Dynamic getter for YONSOON_CLIENT
// This must be evaluated at access time, not module load time,
// because some commands override the client at runtime
Object.defineProperty(Flag, "YONSOON_CLIENT", {
  get() {
    return process.env["YONSOON_CLIENT"] ?? "cli"
  },
  enumerable: true,
  configurable: false,
})
