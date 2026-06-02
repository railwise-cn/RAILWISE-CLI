#!/usr/bin/env bun

import { cp, mkdir, readdir, rename, rm } from "node:fs/promises"
import path from "node:path"

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target) throw new Error("Missing --target or RUST_TARGET")
if (!target.includes("apple-darwin")) throw new Error(`macOS bundle staging is not available for ${target}`)

const dirs = [
  path.join("src-tauri", "target", target, "release", "bundle"),
  path.join("src-tauri", "target", "release", "bundle"),
]

const hasDmg = async (dir: string) => (await readdir(path.join(dir, "dmg")).catch(() => [])).some((item) => item.endsWith(".dmg"))
const source = (await Promise.all(dirs.map(async (dir) => ((await hasDmg(dir)) ? dir : undefined)))).find((item) => item)
if (!source) throw new Error(`Expected a macOS bundle with DMG in ${dirs.join(", ")}`)

const output = path.join("src-tauri", "target", "desktop-release", target)
await rm(output, { recursive: true, force: true })
await mkdir(path.dirname(output), { recursive: true })
await cp(source, output, { recursive: true })

const platform = target.startsWith("aarch64-") ? "darwin-aarch64" : "darwin-x64"
const dmg = path.join(output, "dmg")
const files = (await readdir(dmg)).filter((item) => item.endsWith(".dmg"))
if (files.length !== 1) throw new Error(`Expected exactly one DMG in ${dmg}, found ${files.length}: ${files.join(", ")}`)
await rename(path.join(dmg, files[0]), path.join(dmg, `railwise-desktop-${platform}.dmg`))

console.log(`Staged macOS bundles from ${source} to ${output}`)
