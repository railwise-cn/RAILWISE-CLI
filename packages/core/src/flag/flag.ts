import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("RAILWISE_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  RAILWISE_AUTO_HEAP_SNAPSHOT: truthy("RAILWISE_AUTO_HEAP_SNAPSHOT"),
  RAILWISE_GIT_BASH_PATH: process.env["RAILWISE_GIT_BASH_PATH"],
  RAILWISE_CONFIG: process.env["RAILWISE_CONFIG"],
  RAILWISE_CONFIG_CONTENT: process.env["RAILWISE_CONFIG_CONTENT"],
  RAILWISE_DISABLE_AUTOUPDATE: truthy("RAILWISE_DISABLE_AUTOUPDATE"),
  RAILWISE_ALWAYS_NOTIFY_UPDATE: truthy("RAILWISE_ALWAYS_NOTIFY_UPDATE"),
  RAILWISE_DISABLE_PRUNE: truthy("RAILWISE_DISABLE_PRUNE"),
  RAILWISE_DISABLE_TERMINAL_TITLE: truthy("RAILWISE_DISABLE_TERMINAL_TITLE"),
  RAILWISE_SHOW_TTFD: truthy("RAILWISE_SHOW_TTFD"),
  RAILWISE_DISABLE_AUTOCOMPACT: truthy("RAILWISE_DISABLE_AUTOCOMPACT"),
  RAILWISE_DISABLE_MODELS_FETCH: truthy("RAILWISE_DISABLE_MODELS_FETCH"),
  RAILWISE_DISABLE_MOUSE: truthy("RAILWISE_DISABLE_MOUSE"),
  RAILWISE_FAKE_VCS: process.env["RAILWISE_FAKE_VCS"],
  RAILWISE_SERVER_PASSWORD: process.env["RAILWISE_SERVER_PASSWORD"],
  RAILWISE_SERVER_USERNAME: process.env["RAILWISE_SERVER_USERNAME"],

  // Experimental
  RAILWISE_EXPERIMENTAL_FILEWATCHER: Config.boolean("RAILWISE_EXPERIMENTAL_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  RAILWISE_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("RAILWISE_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("RAILWISE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  RAILWISE_MODELS_URL: process.env["RAILWISE_MODELS_URL"],
  RAILWISE_MODELS_PATH: process.env["RAILWISE_MODELS_PATH"],
  RAILWISE_DB: process.env["RAILWISE_DB"],

  RAILWISE_WORKSPACE_ID: process.env["RAILWISE_WORKSPACE_ID"],
  RAILWISE_EXPERIMENTAL_WORKSPACES: enabledByExperimental("RAILWISE_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get RAILWISE_DISABLE_PROJECT_CONFIG() {
    return truthy("RAILWISE_DISABLE_PROJECT_CONFIG")
  },
  get RAILWISE_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("RAILWISE_EXPERIMENTAL_REFERENCES")
  },
  get RAILWISE_TUI_CONFIG() {
    return process.env["RAILWISE_TUI_CONFIG"]
  },
  get RAILWISE_CONFIG_DIR() {
    return process.env["RAILWISE_CONFIG_DIR"]
  },
  get RAILWISE_PURE() {
    return truthy("RAILWISE_PURE")
  },
  get RAILWISE_PERMISSION() {
    return process.env["RAILWISE_PERMISSION"]
  },
  get RAILWISE_PLUGIN_META_FILE() {
    return process.env["RAILWISE_PLUGIN_META_FILE"]
  },
  get RAILWISE_CLIENT() {
    return process.env["RAILWISE_CLIENT"] ?? "cli"
  },
}
