#!/usr/bin/env bun

import { $ } from "bun"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type Config = {
  identifier?: string
  mainBinaryName?: string
  productName?: string
}

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const name = config.productName ?? "睿威智测 RAILWISE"
const identifier = config.identifier ?? "com.railwiseai.desktop"
const executable = config.mainBinaryName ?? "railwise"
const app = arg("--app", path.join("src-tauri", "target", "release", "bundle", "macos", `${name}.app`))!
const appPath = path.resolve(app)
const timeout = Number(arg("--timeout", "15"))
const readyTimeout = Number(arg("--ready-timeout", "60"))
const skipLaunch = args.includes("--skip-launch") || args.includes("--bundle-only")
const skipReady = args.includes("--skip-ready")
const skipProcessCheck = args.includes("--skip-process-check")
const skipProcessCleanup = skipProcessCheck || args.includes("--skip-process-cleanup")
const preserveRustLog = args.includes("--preserve-rust-log")

if (!preserveRustLog) Bun.env.RUST_LOG = "railwise_lib=info,railwise_desktop=info,sidecar=info"

const logDirs = () => {
  const home = Bun.env.HOME
  if (!home) return []
  return [
    path.join(home, "Library", "Logs", identifier),
    path.join(home, "Library", "Logs", `${identifier}.dev`),
    path.join(home, "Library", "Logs", "ai.railwise.desktop.dev"),
  ]
}

const logFiles = async (since: number) => {
  const files = await Promise.all(
    logDirs().map(async (dir) =>
      (
        await Promise.all(
          (await readdir(dir).catch(() => []))
            .filter((item) => item.startsWith("railwise-desktop_") && item.endsWith(".log"))
            .map(async (item) => {
              const file = path.join(dir, item)
              const info = await stat(file).catch(() => undefined)
              return info && info.mtimeMs >= since - 2_000 ? file : undefined
            }),
        )
      ).filter((item): item is string => Boolean(item)),
    ),
  )
  return files.flat().sort()
}

const tail = (text: string) => text.split("\n").slice(-80).join("\n")
const match = (value: string, words: string[]) => {
  const lower = value.toLowerCase()
  return words.some((word) => lower.includes(word))
}
const confpath = (value: string) => value.match(/(?:[A-Z]:\\|\/)[^\s"']*railwise\.jsonc?/i)?.[0]
const diagnose = (value: string) => {
  const file = confpath(value)
  if (match(value, ["configinvaliderror", "configjsonerror", "configuration is invalid", "railwise.json", "invalid input"])) {
    return [
      "诊断：配置文件需要修复。",
      file ? `配置文件：${file}` : "配置文件：未能从日志中解析路径，请打开 ~/.config/railwise 检查 railwise.json / railwise.jsonc。",
      "下一步：检查模型、智能体和 tools 配置；旧版 tools 分类数组已兼容，仍失败时先临时移走配置文件再重启。",
    ].join("\n")
  }
  if (match(value, ["address already in use", "eaddrinuse"])) {
    return ["诊断：本地端口被占用。", "下一步：退出已有 RAILWISE/railwise serve 进程后重启应用。"].join("\n")
  }
  if (match(value, ["operation not permitted", "permission denied", "eacces", "eperm", "access denied"])) {
    return ["诊断：系统权限阻止启动。", "下一步：确认应用位于可执行目录，并检查配置目录与项目目录读写权限。"].join("\n")
  }
  if (match(value, ["health check", "timed out", "failed to spawn", "failed to start server", "connection"])) {
    return ["诊断：核心服务未能在预期时间内就绪。", "下一步：保留最新 railwise-desktop_*.log，并检查 sidecar 是否启动、配置是否可读。"].join("\n")
  }
  return "诊断：未分类启动失败。下一步：保留下方日志继续排查。"
}
const report = (summary: string, value: string) => [summary, diagnose(value), tail(value)].filter(Boolean).join("\n")

const waitForReady = async (since: number) => {
  const deadline = Date.now() + readyTimeout * 1_000
  let latest = ""
  let seen: string[] = []

  while (Date.now() < deadline) {
    for (const file of await logFiles(since)) {
      seen.push(file)
      const text = await Bun.file(file).text().catch(() => "")
      latest = text || latest
      if (text.includes("CLI health check OK") || text.includes("Loading done, completing initialisation")) {
        console.log(`macOS app sidecar ready from ${file}`)
        return
      }
      if (text.includes("Failed to spawn RAILWISE Server")) {
        throw new Error(report(`macOS app reported server startup failure in ${file}`, text))
      }
    }

    if (!skipProcessCheck && (await running()).length === 0) {
      throw new Error(report("macOS app process exited before sidecar was ready.", latest))
    }

    await sleep(500)
  }

  throw new Error(
    [
      `macOS app did not report sidecar readiness within ${readyTimeout}s.`,
      seen.length > 0 ? `Observed logs:\n${Array.from(new Set(seen)).join("\n")}` : `No railwise-desktop_*.log files found under ${logDirs().join(", ")}`,
      latest ? report("Latest startup diagnosis:", latest) : "",
    ].join("\n"),
  )
}

if ((await stat(appPath).catch(() => undefined))?.isDirectory() !== true) throw new Error(`App bundle not found: ${appPath}`)

await $`bun ./scripts/verify-macos-bundle.ts --app ${appPath}`

if (skipLaunch) {
  console.log(`Skipped macOS launch smoke for ${appPath}`)
  process.exit(0)
}

const running = async () =>
  (await $`pgrep -x ${executable}`.quiet().nothrow()).stdout
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)

if (!skipProcessCleanup) {
  for (const pid of await running()) {
    await $`kill ${pid}`.quiet().nothrow()
  }
}

const launched = Date.now()
const opened = await $`open -n ${appPath}`.quiet().nothrow()
if (opened.exitCode !== 0) {
  const message = `${opened.stderr}\n${opened.stdout}`.trim()
  const launchServicesNote = message.includes("kLSNoExecutableErr")
    ? "LaunchServices reported kLSNoExecutableErr after bundle verification. The app executable exists; this usually means the current shell cannot use macOS graphical launch services."
    : "The app bundle was verified before launch."
  throw new Error(
    [
      `Failed to launch macOS app with open -n: ${appPath}`,
      message,
      launchServicesNote,
      "If Safari.app also fails to open from this shell, rerun this smoke command from a normal macOS Terminal or Finder instead of a sandboxed agent shell.",
    ].join("\n"),
  )
}

if (!skipProcessCheck) {
  const started = Date.now()
  let pids: string[] = []
  while (Date.now() - started < timeout * 1000) {
    pids = await running()
    if (pids.length > 0) break
    await sleep(500)
  }

  if (pids.length === 0) throw new Error(`macOS app process did not appear within ${timeout}s: ${executable}`)

  await sleep(3000)
  pids = await running()
  if (pids.length === 0) throw new Error(`macOS app process exited during smoke window: ${executable}`)
} else {
  await sleep(3000)
}

const files = await readdir(path.join(appPath, "Contents", "MacOS"))
if (!files.includes(executable) || !files.includes("railwise-cli")) {
  throw new Error(`macOS app bundle is missing expected executables: ${files.join(", ")}`)
}

if (!skipReady) await waitForReady(launched)

console.log(`macOS app launch smoke passed for ${appPath}`)
