#!/usr/bin/env bun

import { $ } from "bun"
import { mkdtemp, readdir, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const zipArg = arg("--zip")
const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target && !zipArg) throw new Error("Missing --zip, --target or RUST_TARGET")
if (target && !target.includes("apple-darwin"))
  throw new Error(`macOS app zip verification is not available for ${target}`)

const dirs = target
  ? [
      path.join("src-tauri", "target", target, "release", "bundle", "dmg"),
      path.join("src-tauri", "target", "release", "bundle", "dmg"),
    ]
  : []
const zips = (
  await Promise.all(
    dirs.map(async (dir) =>
      (await readdir(dir).catch(() => []))
        .filter((item) => item.endsWith(".app.zip"))
        .map((item) => path.join(dir, item)),
    ),
  )
).flat()
const zip = zipArg ?? (zips.length === 1 ? zips[0]! : undefined)
if (!zip) throw new Error(`Expected exactly one app zip in ${dirs.join(", ")}; found ${zips.length}`)

const stage = await mkdtemp(path.join(os.tmpdir(), "railwise-appzip-"))

try {
  await $`ditto -x -k ${path.resolve(zip)} ${stage}`
  const apps = (await readdir(stage)).filter((item) => item.endsWith(".app"))
  if (apps.length !== 1) throw new Error(`Expected exactly one app in app zip; found ${apps.length}`)

  const app = path.join(stage, apps[0]!)
  if (target) await $`bun ./scripts/verify-macos-bundle.ts --target ${target} --app ${app}`
  else await $`bun ./scripts/verify-macos-bundle.ts --app ${app}`
  console.log(`Verified macOS app zip ${path.resolve(zip)}`)
} finally {
  await rm(stage, { recursive: true, force: true })
}
