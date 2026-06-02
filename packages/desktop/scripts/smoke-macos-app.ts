#!/usr/bin/env bun

import { $ } from "bun"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type Config = {
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
const executable = config.mainBinaryName ?? "railwise"
const app = arg("--app", path.join("src-tauri", "target", "release", "bundle", "macos", `${name}.app`))!
const timeout = Number(arg("--timeout", "15"))
const skipLaunch = args.includes("--skip-launch")

if ((await stat(app).catch(() => undefined))?.isDirectory() !== true) throw new Error(`App bundle not found: ${app}`)

await $`bun ./scripts/verify-macos-bundle.ts --app ${app}`

if (skipLaunch) {
  console.log(`Skipped macOS launch smoke for ${app}`)
  process.exit(0)
}

const running = async () =>
  (await $`pgrep -x ${executable}`.quiet().nothrow()).stdout
    .toString()
    .trim()
    .split("\n")
    .filter(Boolean)

for (const pid of await running()) {
  await $`kill ${pid}`.quiet().nothrow()
}

const opened = await $`open -n ${app}`.quiet().nothrow()
if (opened.exitCode !== 0) {
  const message = `${opened.stderr}\n${opened.stdout}`.trim()
  throw new Error(
    [
      `Failed to launch macOS app with open -n: ${app}`,
      message,
      "If Safari.app also fails to open from this shell, rerun this smoke command from a normal macOS Terminal instead of a sandboxed agent shell.",
    ].join("\n"),
  )
}

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

const files = await readdir(path.join(app, "Contents", "MacOS"))
if (!files.includes(executable) || !files.includes("railwise-cli")) {
  throw new Error(`macOS app bundle is missing expected executables: ${files.join(", ")}`)
}

console.log(`macOS app launch smoke passed for ${app}`)
