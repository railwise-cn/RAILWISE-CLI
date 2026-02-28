import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { ModelsDev } from "../../provider/models"
import { Config } from "../../config/config"

const PROVIDERS: { id: string; hint: string }[] = [
  { id: "deepseek", hint: "deepseek.com" },
  { id: "anthropic", hint: "console.anthropic.com" },
  { id: "openai", hint: "platform.openai.com" },
  { id: "google", hint: "aistudio.google.com" },
  { id: "openrouter", hint: "openrouter.ai - access multiple providers" },
  { id: "kimi", hint: "platform.moonshot.cn" },
  { id: "glm", hint: "open.bigmodel.cn" },
  { id: "qwen", hint: "dashscope.console.aliyun.com" },
  { id: "github-copilot", hint: "requires Copilot subscription" },
]

export const ProviderCommand = cmd({
  command: "provider",
  describe: "manage AI providers",
  builder: (yargs) =>
    yargs
      .command(ProviderAddCommand)
      .command(ProviderListCommand)
      .command(ProviderRemoveCommand)
      .demandCommand(),
  async handler() {},
})

const ProviderAddCommand = cmd({
  command: "add",
  describe: "add and enable a provider",
  async handler() {
    UI.empty()
    prompts.intro("Add provider")
    await ModelsDev.refresh().catch(() => {})
    const database = await ModelsDev.get()

    const options = [
      ...PROVIDERS.filter((p) => database[p.id]).map((p) => ({
        label: database[p.id].name,
        value: p.id,
        hint: p.hint,
      })),
      { label: "Other", value: "other", hint: "enter provider ID manually" },
    ]

    const provider = await prompts.select({
      message: "Select a provider",
      options,
    })
    if (prompts.isCancel(provider)) throw new UI.CancelledError()

    const id = await (async () => {
      if (provider !== "other") return provider
      const custom = await prompts.text({
        message: "Enter provider id",
        validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "a-z, 0-9 and hyphens only"),
      })
      if (prompts.isCancel(custom)) throw new UI.CancelledError()
      return custom
    })()

    const info = database[id]
    if (info && info.env.length > 0) {
      prompts.log.info(`API key environment variable: ${info.env[0]}`)
    }

    const key = await prompts.password({
      message: `Enter your ${info?.name ?? id} API key`,
      validate: (x) => (x && x.length > 0 ? undefined : "Required"),
    })
    if (prompts.isCancel(key)) throw new UI.CancelledError()

    await Auth.set(id, { type: "api", key })
    prompts.log.success(`Saved credential for ${info?.name ?? id}`)

    const config = await Config.getGlobal()
    const enabled = config.enabled_providers
    if (enabled && !enabled.includes(id)) {
      await Config.updateGlobal({ enabled_providers: [...enabled, id] })
      prompts.log.info(`Added ${id} to enabled_providers`)
    }

    prompts.outro("Done")
  },
})

const ProviderListCommand = cmd({
  command: "list",
  aliases: ["ls"],
  describe: "list provider status",
  async handler() {
    UI.empty()
    prompts.intro("Providers")
    const database = await ModelsDev.get()
    const auth = await Auth.all()
    const config = await Config.getGlobal()
    const enabled = config.enabled_providers ? new Set(config.enabled_providers) : null
    const disabled = new Set(config.disabled_providers ?? [])

    const configured: string[] = []
    const available: string[] = []

    for (const [id, provider] of Object.entries(database)) {
      if (disabled.has(id)) continue
      if (enabled && !enabled.has(id)) continue
      const credential = auth[id]
      const env = provider.env.some((k) => process.env[k])
      if (credential || env) {
        const source = credential ? credential.type : "env"
        const models = Object.keys(provider.models).length
        prompts.log.success(`${provider.name} ${UI.Style.TEXT_DIM}${source} · ${models} models`)
        configured.push(id)
        continue
      }
      available.push(id)
    }

    if (configured.length === 0) {
      prompts.log.warn("No providers configured. Run `railwise setup` or `railwise provider add`")
    }

    if (enabled) {
      prompts.log.info(`${UI.Style.TEXT_DIM}Filter: enabled_providers = [${[...enabled].join(", ")}]`)
    }

    if (available.length > 0 && !enabled) {
      prompts.log.info(
        `${UI.Style.TEXT_DIM}${available.length} unconfigured providers available. Use \`railwise provider add\` to configure.`,
      )
    }

    prompts.outro(`${configured.length} configured`)
  },
})

const ProviderRemoveCommand = cmd({
  command: "remove",
  aliases: ["rm"],
  describe: "remove a provider credential and disable it",
  async handler() {
    UI.empty()
    prompts.intro("Remove provider")
    const auth = await Auth.all()
    const entries = Object.entries(auth)

    if (entries.length === 0) {
      prompts.log.error("No credentials found")
      prompts.outro("Done")
      return
    }

    const database = await ModelsDev.get()
    const id = await prompts.select({
      message: "Select provider to remove",
      options: entries.map(([key, value]) => ({
        label: (database[key]?.name ?? key) + UI.Style.TEXT_DIM + ` (${value.type})`,
        value: key,
      })),
    })
    if (prompts.isCancel(id)) throw new UI.CancelledError()

    await Auth.remove(id)
    prompts.log.success(`Removed credential for ${database[id]?.name ?? id}`)

    const config = await Config.getGlobal()
    const enabled = config.enabled_providers
    if (enabled && enabled.includes(id)) {
      const next = enabled.filter((p) => p !== id)
      await Config.updateGlobal({ enabled_providers: next.length > 0 ? next : undefined })
      prompts.log.info(`Removed ${id} from enabled_providers`)
    }

    prompts.outro("Done")
  },
})
