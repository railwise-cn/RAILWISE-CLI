import { Config, ConfigProvider, Context, Effect, Layer, Option } from "effect"
import { ConfigService } from "@/effect/config-service"

const bool = (name: string) => Config.boolean(name).pipe(Config.withDefault(false))
const positiveInteger = (name: string) =>
  Config.number(name).pipe(
    Config.map((value) => (Number.isInteger(value) && value > 0 ? value : undefined)),
    Config.orElse(() => Config.succeed(undefined)),
  )
const experimental = bool("RAILWISE_EXPERIMENTAL")
const enabledByExperimental = (name: string) =>
  Config.all({ experimental, enabled: Config.boolean(name).pipe(Config.option) }).pipe(
    Config.map((flags) => Option.getOrElse(flags.enabled, () => flags.experimental)),
  )

export class Service extends ConfigService.Service<Service>()("@railwise/RuntimeFlags", {
  autoShare: bool("RAILWISE_AUTO_SHARE"),
  pure: bool("RAILWISE_PURE"),
  disableDefaultPlugins: bool("RAILWISE_DISABLE_DEFAULT_PLUGINS"),
  disableChannelDb: bool("RAILWISE_DISABLE_CHANNEL_DB"),
  disableEmbeddedWebUi: bool("RAILWISE_DISABLE_EMBEDDED_WEB_UI"),
  disableExternalSkills: bool("RAILWISE_DISABLE_EXTERNAL_SKILLS"),
  disableLspDownload: bool("RAILWISE_DISABLE_LSP_DOWNLOAD"),
  skipMigrations: bool("RAILWISE_SKIP_MIGRATIONS"),
  disableClaudeCodePrompt: Config.all({
    broad: bool("RAILWISE_DISABLE_CLAUDE_CODE"),
    direct: bool("RAILWISE_DISABLE_CLAUDE_CODE_PROMPT"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  disableClaudeCodeSkills: Config.all({
    broad: bool("RAILWISE_DISABLE_CLAUDE_CODE"),
    direct: bool("RAILWISE_DISABLE_CLAUDE_CODE_SKILLS"),
  }).pipe(Config.map((flags) => flags.broad || flags.direct)),
  enableExa: Config.all({
    experimental,
    enabled: bool("RAILWISE_ENABLE_EXA"),
    legacy: bool("RAILWISE_EXPERIMENTAL_EXA"),
  }).pipe(Config.map((flags) => flags.experimental || flags.enabled || flags.legacy)),
  enableParallel: Config.all({
    enabled: bool("RAILWISE_ENABLE_PARALLEL"),
    legacy: bool("RAILWISE_EXPERIMENTAL_PARALLEL"),
  }).pipe(Config.map((flags) => flags.enabled || flags.legacy)),
  enableExperimentalModels: bool("RAILWISE_ENABLE_EXPERIMENTAL_MODELS"),
  enableQuestionTool: bool("RAILWISE_ENABLE_QUESTION_TOOL"),
  experimentalScout: enabledByExperimental("RAILWISE_EXPERIMENTAL_SCOUT"),
  experimentalBackgroundSubagents: enabledByExperimental("RAILWISE_EXPERIMENTAL_BACKGROUND_SUBAGENTS"),
  experimentalLspTy: bool("RAILWISE_EXPERIMENTAL_LSP_TY"),
  experimentalLspTool: enabledByExperimental("RAILWISE_EXPERIMENTAL_LSP_TOOL"),
  experimentalOxfmt: enabledByExperimental("RAILWISE_EXPERIMENTAL_OXFMT"),
  experimentalPlanMode: enabledByExperimental("RAILWISE_EXPERIMENTAL_PLAN_MODE"),
  experimentalEventSystem: enabledByExperimental("RAILWISE_EXPERIMENTAL_EVENT_SYSTEM"),
  experimentalWorkspaces: enabledByExperimental("RAILWISE_EXPERIMENTAL_WORKSPACES"),
  experimentalIconDiscovery: enabledByExperimental("RAILWISE_EXPERIMENTAL_ICON_DISCOVERY"),
  outputTokenMax: positiveInteger("RAILWISE_EXPERIMENTAL_OUTPUT_TOKEN_MAX"),
  bashDefaultTimeoutMs: positiveInteger("RAILWISE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS"),
  experimentalNativeLlm: bool("RAILWISE_EXPERIMENTAL_NATIVE_LLM"),
  experimentalWebSockets: bool("RAILWISE_EXPERIMENTAL_WEBSOCKETS"),
  client: Config.string("RAILWISE_CLIENT").pipe(Config.withDefault("cli")),
}) {}

export type Info = Context.Service.Shape<typeof Service>

const emptyConfigLayer = Service.defaultLayer.pipe(
  Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))),
  Layer.orDie,
)

export const layer = (overrides: Partial<Info> = {}) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      const flags = yield* Service
      return Service.of({ ...flags, ...overrides })
    }),
  ).pipe(Layer.provide(emptyConfigLayer))

export const defaultLayer = Service.defaultLayer.pipe(Layer.orDie)

export * as RuntimeFlags from "./runtime-flags"
