import { Auth } from "../../auth"
import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { ModelsDev } from "../../provider/models"
import { Config } from "../../config/config"

const PROVIDERS: { id: string; hint: string; register?: string; note?: string }[] = [
  { id: "zhipuai", hint: "智谱 GLM — 永久免费", register: "https://open.bigmodel.cn", note: "glm-4-flash / glm-z1-flash 永久免费，零成本起步首选" },
  { id: "deepseek", hint: "DeepSeek — 注册送 500 万 tokens", register: "https://platform.deepseek.com", note: "数学推理最强的国产模型" },
  { id: "kimi", hint: "Kimi — 注册送免费额度", register: "https://platform.moonshot.cn", note: "131K 长上下文，中文能力优秀" },
  { id: "minimax", hint: "MiniMax — 注册送免费额度", register: "https://platform.minimaxi.com", note: "百万上下文" },
  { id: "anthropic", hint: "Anthropic Claude — 付费", register: "https://console.anthropic.com" },
  { id: "openai", hint: "OpenAI GPT — 付费", register: "https://platform.openai.com" },
  { id: "google", hint: "Google Gemini — 付费", register: "https://aistudio.google.com" },
  { id: "github-copilot", hint: "GitHub Copilot — 需订阅" },
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
    { label: "其他", value: "other", hint: "手动输入 provider ID" },
  ]

  const provider = await prompts.select({
    message: "选择模型厂商",
    options,
  })
  if (prompts.isCancel(provider)) throw new UI.CancelledError()

  const id = await (async () => {
    if (provider !== "other") return provider
    const custom = await prompts.text({
      message: "输入 provider ID",
      validate: (x) => (x && x.match(/^[0-9a-z-]+$/) ? undefined : "只能包含小写字母、数字和连字符"),
    })
    if (prompts.isCancel(custom)) throw new UI.CancelledError()
    return custom
  })()

  const meta = PROVIDERS.find((p) => p.id === id)
  const info = database[id]

  if (meta?.register) {
    prompts.log.info(`注册地址：${meta.register}`)
    if (meta.note) prompts.log.info(`💡 ${meta.note}`)
  }
  if (info && info.env.length > 0) {
    prompts.log.info(`环境变量：${info.env[0]}`)
  }

  const key = await prompts.password({
    message: `输入 ${info?.name ?? id} 的 API Key`,
    validate: (x) => (x && x.length > 0 ? undefined : "不能为空"),
  })
  if (prompts.isCancel(key)) throw new UI.CancelledError()

  await Auth.set(id, { type: "api", key })
  await Config.syncProviderApiKey(id, key).catch(() => {})
  prompts.log.success(`已保存 ${info?.name ?? id} 的密钥`)

  return id
}

async function wizard() {
  const database = await ModelsDev.get()
  const configured: string[] = []

  prompts.log.info("推荐：先注册智谱 GLM（永久免费），即可零成本体验全部功能")

  configured.push(await addProvider(database))

  for (;;) {
    const more = await prompts.confirm({
      message: "是否继续添加其他厂商？",
      initialValue: false,
    })
    if (prompts.isCancel(more)) throw new UI.CancelledError()
    if (!more) break
    configured.push(await addProvider(database))
  }

  const restrict = await prompts.confirm({
    message: "只显示已配置厂商的模型？（推荐选是，避免列表过长）",
    initialValue: true,
  })
  if (prompts.isCancel(restrict)) throw new UI.CancelledError()

  if (restrict) {
    await Config.updateGlobal({ enabled_providers: configured })
    prompts.log.info(`已设置 enabled_providers = [${configured.join(", ")}]`)
  }
}

export async function setup() {
  const ready = await hasCredentials()
  if (ready) return

  UI.empty()
  prompts.intro("欢迎使用 railwise — 让我们配置第一个 AI 厂商")

  await ModelsDev.refresh().catch(() => {})
  await wizard()

  prompts.outro("配置完成")
}

export const SetupCommand = cmd({
  command: "setup",
  describe: "配置 AI 厂商",
  async handler() {
    UI.empty()
    prompts.intro("厂商配置")
    await ModelsDev.refresh().catch(() => {})
    await wizard()
    prompts.outro("配置完成")
  },
})
