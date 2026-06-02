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

const target = arg("--target", Bun.env.RUST_TARGET ?? Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target) throw new Error("Missing --target or RUST_TARGET")
if (!target.includes("apple-darwin")) throw new Error(`macOS DMG verification is not available for ${target}`)

const dir = path.join("src-tauri", "target", target, "release", "bundle", "dmg")
const dmgs = (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".dmg"))
const dmg = arg("--dmg", dmgs.length === 1 ? path.join(dir, dmgs[0]!) : undefined)
if (!dmg) throw new Error(`Expected exactly one DMG in ${dir}; found ${dmgs.length}`)

const mounted = async () => {
  const info = await $`hdiutil info`.quiet().text()
  const sections = info.split("image-path").slice(1).map((item) => `image-path${item}`)
  const section = sections.find((item) => item.includes(dmg))
  return section
    ?.split("\n")
    .map((item) => item.trim())
    .find((item) => item.includes("/Volumes/"))
    ?.split(/\t+/)
    .at(-1)
}

let mount = (await mounted()) ?? (await mkdtemp(path.join(os.tmpdir(), "railwise-dmg-")))
let attached = false

try {
  if (!mount.startsWith("/Volumes/")) {
    await $`hdiutil attach -readonly -noverify -noautoopen -nobrowse -mountpoint ${mount} ${dmg}`
    attached = true
  }

  const apps = (await readdir(mount)).filter((item) => item.endsWith(".app"))
  if (apps.length !== 1) throw new Error(`Expected exactly one app in mounted DMG; found ${apps.length}`)

  await $`bun ./scripts/verify-macos-bundle.ts --target ${target} --app ${path.join(mount, apps[0]!)}`
  console.log(`Verified macOS DMG ${dmg}`)
} finally {
  if (attached) await $`hdiutil detach ${mount}`.quiet().catch(() => undefined)
  if (!mount.startsWith("/Volumes/")) await rm(mount, { recursive: true, force: true })
}
