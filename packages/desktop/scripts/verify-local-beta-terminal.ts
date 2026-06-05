#!/usr/bin/env bun

import { $ } from "bun"
import { readFile, stat, writeFile } from "node:fs/promises"
import path from "node:path"

type Config = {
  productName?: string
}

type Package = {
  version?: string
}

const args = Bun.argv.slice(2)
const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}
const tail = (text: string) => text.split("\n").slice(-40).join("\n").trim()

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const pkg = (await Bun.file("package.json").json()) as Package
const name = config.productName ?? "睿威智测 RAILWISE"
const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x64" : process.arch
const zip = arg(
  "--zip",
  path.join("src-tauri", "target", "release", "bundle", "dmg", `${name}_${pkg.version ?? "0.0.0"}_local_${arch}.app.zip`),
)!
const appArg = arg("--app")
const dest = arg("--dest", appArg ? path.dirname(appArg) : path.join("src-tauri", "target", "release", "local-app-terminal"))!
const app = appArg ?? path.join(dest, `${name}.app`)
const readyTimeout = arg("--ready-timeout", "90")!
const doc = arg("--doc", path.join("..", "..", "docs", "dev", "13-desktop-beta-manual-check.md"))!
const skipRecord = args.includes("--skip-record")
const zipPath = path.resolve(zip)
const destPath = path.resolve(dest)
const appPath = path.resolve(app)
const docPath = path.resolve(doc)

if ((await stat(zipPath).catch(() => undefined))?.isFile() !== true) {
  throw new Error(
    [
      `Local beta app zip not found: ${zipPath}`,
      "Run `bun run build:dmg:local` or `bun run package:dmg:local` from packages/desktop first.",
    ].join("\n"),
  )
}

const prepare = await $`bun ./scripts/open-local-macos-app.ts --skip-open --zip ${zipPath} --dest ${destPath}`.nothrow()
const smoke =
  prepare.exitCode === 0
    ? await $`bun ./scripts/smoke-macos-app.ts --app ${appPath} --ready-timeout ${readyTimeout} --skip-process-check`.nothrow()
    : undefined
const ok = prepare.exitCode === 0 && smoke?.exitCode === 0
const summary = [
  prepare.exitCode === 0 ? "prepare: passed" : `prepare: failed (${prepare.exitCode})`,
  smoke ? (smoke.exitCode === 0 ? "smoke: passed" : `smoke: failed (${smoke.exitCode})`) : "smoke: skipped",
].join(", ")

const record = [
  "<!-- terminal-smoke-latest:start -->",
  `- 时间：${new Date().toISOString()}`,
  `- 结果：${ok ? "通过" : "失败"}`,
  `- App：${path.relative(path.resolve("..", ".."), appPath)}`,
  `- ZIP：${path.relative(path.resolve("..", ".."), zipPath)}`,
  `- 命令：\`bun run verify:local-beta:terminal -- --ready-timeout ${readyTimeout}\``,
  `- 摘要：${summary}`,
  "",
  "```text",
  tail([prepare.stdout, prepare.stderr, smoke?.stdout ?? "", smoke?.stderr ?? ""].map((item) => item.toString()).join("\n")),
  "```",
  "<!-- terminal-smoke-latest:end -->",
].join("\n")

const status = [
  "<!-- manual-acceptance-status:start -->",
  `- automatic_checks=${prepare.exitCode === 0 ? "passed" : "failed"}`,
  `- terminal_smoke=${ok ? "passed" : "failed"}`,
  "- finder_launch=pending",
  "- manual_checklist=pending",
  "- beta_decision=pending",
  "<!-- manual-acceptance-status:end -->",
].join("\n")

async function writeRecord() {
  const source = await readFile(docPath, "utf8")
  const start = "<!-- terminal-smoke-latest:start -->"
  const end = "<!-- terminal-smoke-latest:end -->"
  const statusStart = "<!-- manual-acceptance-status:start -->"
  const statusEnd = "<!-- manual-acceptance-status:end -->"
  const next = source.includes(start) && source.includes(end)
    ? source.replace(new RegExp(`${start}[\\s\\S]*?${end}`), record)
    : source.replace("\n## 人工验收项", `\n## 终端启动验收记录\n\n${record}\n\n## 人工验收项`)
  const final = next.includes(statusStart) && next.includes(statusEnd)
    ? next.replace(new RegExp(`${statusStart}[\\s\\S]*?${statusEnd}`), status)
    : next.replace("\n## 启动说明", `\n${status}\n\n## 启动说明`)
  await writeFile(docPath, final)
}

if (!skipRecord) await writeRecord()

console.log(`Local beta terminal verification ${ok ? "passed" : "failed"}: ${summary}`)
if (!skipRecord) console.log(`Recorded result in ${path.relative(process.cwd(), docPath)}`)
if (!ok) process.exit(1)
