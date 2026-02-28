import { cmd } from "./cmd"
import * as prompts from "@clack/prompts"
import { UI } from "../ui"
import { Config } from "../../config/config"
import { Instance } from "../../project/instance"
import { Global } from "../../global"
import { Filesystem } from "../../util/filesystem"
import { modify, applyEdits } from "jsonc-parser"
import path from "path"

const PRESETS: { value: string; label: string; hint: string }[] = [
  { value: "preset.docx.default", label: "云文档读取 (Docs)", hint: "读取飞书云文档内容" },
  { value: "preset.wiki.default", label: "知识库 (Wiki)", hint: "读取知识库和企业公开知识库" },
  { value: "preset.bitable.default", label: "多维表格 (Bitable)", hint: "创建和管理多维表格" },
  { value: "preset.im.default", label: "即时消息 (IM)", hint: "发送消息到群聊或个人" },
  { value: "preset.calendar.default", label: "日历 (Calendar)", hint: "管理日程和会议" },
  { value: "preset.sheets.default", label: "电子表格 (Sheets)", hint: "读取和管理电子表格" },
  { value: "preset.task.default", label: "任务 (Task)", hint: "创建和管理飞书任务" },
]

async function resolveConfigPath(baseDir: string, global = false) {
  const candidates = [path.join(baseDir, "railwise.json"), path.join(baseDir, "railwise.jsonc")]
  if (!global) {
    candidates.push(path.join(baseDir, ".railwise", "railwise.json"), path.join(baseDir, ".railwise", "railwise.jsonc"))
  }
  for (const candidate of candidates) {
    if (await Filesystem.exists(candidate)) return candidate
  }
  return candidates[0]
}

async function addMcpToConfig(name: string, mcpConfig: Config.Mcp, configPath: string) {
  let text = "{}"
  if (await Filesystem.exists(configPath)) {
    text = await Filesystem.readText(configPath)
  }
  const edits = modify(text, ["mcp", name], mcpConfig, {
    formattingOptions: { tabSize: 2, insertSpaces: true },
  })
  const result = applyEdits(text, edits)
  await Filesystem.write(configPath, result)
  return configPath
}

export const FeishuCommand = cmd({
  command: "feishu",
  describe: "connect to Feishu/Lark for docs, wiki, and bitable access",
  async handler() {
    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        prompts.intro("飞书/Lark MCP 集成")

        prompts.log.info(
          "准备工作：\n" +
            "  1. 访问 open.feishu.cn 创建应用并获取凭证\n" +
            "  2. 为应用添加所需 API 权限（云文档、知识库、多维表格等）\n" +
            "  3. 如需以用户身份访问，设置 OAuth 重定向 URL 为 http://localhost:3000/callback",
        )

        const appId = await prompts.text({
          message: "输入 App ID",
          placeholder: "cli_xxxxxxxx",
          validate: (x) => (x && x.length > 0 ? undefined : "必填"),
        })
        if (prompts.isCancel(appId)) throw new UI.CancelledError()

        const appSecret = await prompts.password({
          message: "输入 App Secret",
          validate: (x) => (x && x.length > 0 ? undefined : "必填"),
        })
        if (prompts.isCancel(appSecret)) throw new UI.CancelledError()

        const features = await prompts.multiselect({
          message: "选择启用的功能",
          options: PRESETS.map((p) => ({
            value: p.value,
            label: p.label,
            hint: p.hint,
          })),
          initialValues: ["preset.docx.default", "preset.wiki.default", "preset.bitable.default"],
          required: true,
        })
        if (prompts.isCancel(features)) throw new UI.CancelledError()

        const oauth = await prompts.confirm({
          message: "以用户身份访问？（推荐，可访问个人文档和企业公开知识库）",
          initialValue: true,
        })
        if (prompts.isCancel(oauth)) throw new UI.CancelledError()

        const domain = await prompts.select({
          message: "选择版本",
          options: [
            { value: "feishu", label: "飞书（国内版）", hint: "open.feishu.cn" },
            { value: "lark", label: "Lark（国际版）", hint: "open.larksuite.com" },
          ],
        })
        if (prompts.isCancel(domain)) throw new UI.CancelledError()

        const args = ["-y", "@larksuiteoapi/lark-mcp", "mcp", "-a", appId, "-s", appSecret]

        if (features.length > 0) {
          args.push("-t", features.join(","))
        }

        if (oauth) {
          args.push("--oauth", "--token-mode", "user_access_token")
        }

        if (domain === "lark") {
          args.push("--domain", "https://open.larksuite.com")
        }

        const mcpConfig: Config.Mcp = {
          type: "local",
          command: ["npx", ...args],
        }

        const project = Instance.project
        const [projectConfigPath, globalConfigPath] = await Promise.all([
          resolveConfigPath(Instance.worktree),
          resolveConfigPath(Global.Path.config, true),
        ])

        let configPath = globalConfigPath
        if (project.vcs === "git") {
          const scope = await prompts.select({
            message: "配置范围",
            options: [
              { value: globalConfigPath, label: "全局", hint: globalConfigPath },
              { value: projectConfigPath, label: "当前项目", hint: projectConfigPath },
            ],
          })
          if (prompts.isCancel(scope)) throw new UI.CancelledError()
          configPath = scope
        }

        await addMcpToConfig("feishu", mcpConfig, configPath)
        prompts.log.success(`飞书 MCP 已添加到 ${configPath}`)

        if (oauth) {
          prompts.log.info(
            "首次使用前需要登录授权，请在终端运行：\n" +
              `  npx -y @larksuiteoapi/lark-mcp login -a ${appId} -s ${appSecret}`,
          )
        }

        prompts.outro("完成 — 飞书云文档、知识库、多维表格已就绪")
      },
    })
  },
})
