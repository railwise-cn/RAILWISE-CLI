import type { Argv } from "yargs"
import { cmd } from "./cmd"
import * as fs from "node:fs"
import * as path from "node:path"
import { processSurveyMessage } from "../../bot/pipeline"
import type { BotAdapter, IncomingMessage } from "../../bot/types"
import { EOL } from "os"

function markdown(card: unknown) {
  if (!card || typeof card !== "object") return undefined
  if (!("markdown" in card)) return undefined
  const value = card.markdown
  if (typeof value !== "string") return undefined
  return value
}

const ConsoleBotAdapter: BotAdapter = {
  platform: "console",
  async start() {},
  async stop() {},
  setHandler() {},
  async sendMessage(params) {
    process.stdout.write(EOL + "=== [Message from RAILWISE Bot] ===" + EOL)
    const text = markdown(params.card)
    if (text) {
      process.stdout.write(text + EOL)
    } else if (params.text) {
      process.stdout.write(params.text + EOL)
    }
    process.stdout.write("===================================" + EOL)
  },
  async sendExcelReport(params) {
    process.stdout.write(EOL + "=== [Excel Report Generated] ===" + EOL)
    process.stdout.write(`File: ${params.name}` + EOL)
    process.stdout.write(`Summary: ${params.summary}` + EOL)
    
    const outPath = path.join(process.cwd(), params.name)
    if (params.data) {
      fs.writeFileSync(outPath, params.data)
    }
    process.stdout.write(`Saved to: ${outPath}` + EOL)
    process.stdout.write("================================" + EOL)
  }
}

export const SurveyCommand = cmd({
  command: "survey <command>",
  describe: "RAILWISE 测绘与产量管理命令 (Survey & Production commands)",
  builder: (yargs: Argv) => {
    return yargs
      .command(
        "process [file]",
        "处理测绘文件 (Process a survey file GSI/DAT)",
        (y) => y.positional("file", { type: "string", describe: "GSI或DAT文件路径 (Path to GSI or DAT file)" }),
        async (args) => {
          if (!args.file) {
            process.stderr.write("请提供文件路径 (Please provide a file path)." + EOL)
            process.exit(1)
          }
          
          const filePath = path.resolve(process.cwd(), args.file as string)
          if (!fs.existsSync(filePath)) {
            process.stderr.write(`未找到文件 (File not found): ${filePath}` + EOL)
            process.exit(1)
          }

          const fileContent = fs.readFileSync(filePath)
          const fileName = path.basename(filePath)
          
          process.stdout.write(`正在处理文件 (Processing file): ${fileName}...` + EOL)
          
          const msg: IncomingMessage = {
            platform: "console",
            userId: "cli-user",
            groupId: "cli-group",
            text: "",
            images: [],
            file: {
              name: fileName,
              data: fileContent
            }
          }
          
          await processSurveyMessage(ConsoleBotAdapter, msg)
        }
      )
      .command(
        "report",
        "生成每日产量日报 (Generate daily production report)",
        () => {},
        async () => {
          const msg: IncomingMessage = {
            platform: "console",
            userId: "cli-user",
            text: "/daily-report",
            images: [],
          }
          await processSurveyMessage(ConsoleBotAdapter, msg)
        }
      )
      .demandCommand()
  },
  handler: () => {}
})
