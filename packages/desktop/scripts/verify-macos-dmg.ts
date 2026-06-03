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

const dmgArg = arg("--dmg")
const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target && !dmgArg) throw new Error("Missing --dmg, --target or RUST_TARGET")
if (target && !target.includes("apple-darwin")) throw new Error(`macOS DMG verification is not available for ${target}`)

const dirs = target
  ? [
      path.join("src-tauri", "target", target, "release", "bundle", "dmg"),
      path.join("src-tauri", "target", "release", "bundle", "dmg"),
    ]
  : []
const dmgs = (
  await Promise.all(
    dirs.map(async (dir) =>
      (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".dmg")).map((item) => path.join(dir, item)),
    ),
  )
).flat()
const dmg = dmgArg ?? (dmgs.length === 1 ? dmgs[0]! : undefined)
if (!dmg) throw new Error(`Expected exactly one DMG in ${dirs.join(", ")}; found ${dmgs.length}`)
const image = path.resolve(dmg)

const mounted = async () => {
  const info = await $`hdiutil info`.quiet().text()
  const sections = info
    .split("image-path")
    .slice(1)
    .map((item) => `image-path${item}`)
  const section = sections.find((item) => item.includes(image))
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
    await $`hdiutil attach -readonly -noverify -noautoopen -nobrowse -mountpoint ${mount} ${image}`
    attached = true
  }

  const apps = (await readdir(mount)).filter((item) => item.endsWith(".app"))
  if (apps.length !== 1) throw new Error(`Expected exactly one app in mounted DMG; found ${apps.length}`)

  const app = path.join(mount, apps[0]!)
  if (target) await $`bun ./scripts/verify-macos-bundle.ts --target ${target} --app ${app}`
  else await $`bun ./scripts/verify-macos-bundle.ts --app ${app}`
  console.log(`Verified macOS DMG ${image}`)
} finally {
  if (attached) await $`hdiutil detach ${mount}`.quiet().catch(() => undefined)
  if (!mount.startsWith("/Volumes/")) await rm(mount, { recursive: true, force: true })
}
