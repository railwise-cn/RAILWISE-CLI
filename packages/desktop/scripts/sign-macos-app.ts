#!/usr/bin/env bun

import { $ } from "bun"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type Config = {
  productName?: string
}

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const appArg = arg("--app")
const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (target && !target.includes("apple-darwin")) throw new Error(`macOS signing is not available for ${target}`)

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const dir = target
  ? path.join("src-tauri", "target", target, "release", "bundle", "macos")
  : path.join("src-tauri", "target", "release", "bundle", "macos")
const apps = (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".app"))
const fallback = path.join(dir, `${config.productName ?? "睿威智测 RAILWISE"}.app`)
const app = appArg ?? (apps.length === 1 ? path.join(dir, apps[0]!) : fallback)

const info = await stat(app).catch(() => undefined)
if (!info?.isDirectory()) throw new Error(`App bundle not found: ${app}`)

const plist = path.join(app, "Contents", "Info.plist")
const ensure = async (key: string, type: string, value: string) => {
  const result = await $`/usr/libexec/PlistBuddy -c ${`Print :${key}`} ${plist}`.quiet().nothrow()
  if (result.exitCode === 0) {
    await $`/usr/libexec/PlistBuddy -c ${`Set :${key} ${value}`} ${plist}`
    return
  }
  await $`/usr/libexec/PlistBuddy -c ${`Add :${key} ${type} ${value}`} ${plist}`
}

await ensure("LSRequiresCarbon", "bool", "false")
await ensure("NSPrincipalClass", "string", "NSApplication")

const identity = Bun.env.APPLE_SIGNING_IDENTITY?.trim() || "-"

if (identity === "-") {
  await $`codesign --force --deep --sign - ${app}`
} else {
  await $`codesign --force --deep --options runtime --entitlements src-tauri/entitlements.plist --sign ${identity} ${app}`
}

await $`codesign --verify --deep --strict --verbose=4 ${app}`

console.log(`Verified macOS app signature for ${app}`)
