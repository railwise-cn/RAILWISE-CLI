#!/usr/bin/env bun

import { $ } from "bun"
import { stat } from "node:fs/promises"
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

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const pkg = (await Bun.file("package.json").json()) as Package
const name = config.productName ?? "睿威智测 RAILWISE"
const arch = process.arch === "arm64" ? "aarch64" : process.arch === "x64" ? "x64" : process.arch
const zip = arg(
  "--zip",
  path.join("src-tauri", "target", "release", "bundle", "dmg", `${name}_${pkg.version ?? "0.0.0"}_local_${arch}.app.zip`),
)!
const appArg = arg("--app")
const dest = arg("--dest", appArg ? path.dirname(appArg) : path.join("src-tauri", "target", "release", "local-app-verify"))!
const app = appArg ?? path.join(dest, `${name}.app`)
const zipPath = path.resolve(zip)
const destPath = path.resolve(dest)
const appPath = path.resolve(app)
const terminalApp = path.join("src-tauri", "target", "release", "local-app-terminal", `${name}.app`)

if ((await stat(zipPath).catch(() => undefined))?.isFile() !== true) {
  throw new Error(
    [
      `Local beta app zip not found: ${zipPath}`,
      "Run `bun run build:dmg:local` or `bun run package:dmg:local` from packages/desktop first.",
    ].join("\n"),
  )
}

await $`bun ./scripts/open-local-macos-app.ts --skip-open --zip ${zipPath} --dest ${destPath}`
await $`bun ./scripts/smoke-macos-app.ts --app ${appPath} --bundle-only`

console.log(
  [
    "",
    "Local Desktop beta package verified.",
    `Bundle-only verification app: ${path.relative(process.cwd(), appPath)}`,
    "",
    "Next commands for a normal macOS Terminal:",
    `cd ${process.cwd()}`,
    "bun run verify:local-beta:terminal",
    "bun run open:macos:local",
    `bun run smoke:macos -- --app ${JSON.stringify(terminalApp)} --ready-timeout 90 --skip-process-check`,
    "bun run package:dmg:local -- --require-dmg",
  ].join("\n"),
)
