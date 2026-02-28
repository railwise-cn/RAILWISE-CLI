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

async function hasCredentials() {
  const auth = await Auth.all()
  if (Object.keys(auth).length > 0) return true
  const database = await ModelsDev.get()
  for (const provider of Object.values(database)) {
    for (const key of provider.env) {
      if (process.env[key]) return true
    }
  }
  return false
}

async function addProvider(database: Record<string, ModelsDev.Provider>) {
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
  await Config.syncProviderApiKey(id, key).catch(() => {})
  prompts.log.success(`Saved credential for ${info?.name ?? id}`)

  return id
}

async function wizard() {
  const database = await ModelsDev.get()
  const configured: string[] = []

  configured.push(await addProvider(database))

  for (;;) {
    const more = await prompts.confirm({
      message: "Add another provider?",
      initialValue: false,
    })
    if (prompts.isCancel(more)) throw new UI.CancelledError()
    if (!more) break
    configured.push(await addProvider(database))
  }

  const restrict = await prompts.confirm({
    message: "Only show models from configured providers? (recommended)",
    initialValue: true,
  })
  if (prompts.isCancel(restrict)) throw new UI.CancelledError()

  if (restrict) {
    await Config.updateGlobal({ enabled_providers: configured })
    prompts.log.info(`Set enabled_providers to [${configured.join(", ")}]`)
  }
}

export async function setup() {
  const ready = await hasCredentials()
  if (ready) return

  UI.empty()
  prompts.intro("Welcome to railwise — let's set up your first provider")

  await ModelsDev.refresh().catch(() => {})
  await wizard()

  prompts.outro("Setup complete")
}

export const SetupCommand = cmd({
  command: "setup",
  describe: "configure your first AI provider",
  async handler() {
    UI.empty()
    prompts.intro("Provider setup")
    await ModelsDev.refresh().catch(() => {})
    await wizard()
    prompts.outro("Setup complete")
  },
})
