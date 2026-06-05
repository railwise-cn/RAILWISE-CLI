#!/usr/bin/env bun

import { $ } from "bun"
import { readdir } from "node:fs/promises"
import path from "node:path"

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
const dmgArg = arg("--dmg")
const profile = arg("--keychain-profile")

if (!target && !dmgArg) throw new Error("Missing --dmg, --target or RUST_TARGET")
if (target && !target.includes("apple-darwin")) throw new Error(`macOS DMG notarization is not available for ${target}`)

const dirs = target
  ? [
      path.join("src-tauri", "target", target, "release", "bundle", "dmg"),
      path.join("src-tauri", "target", "release", "bundle", "dmg"),
    ]
  : []
const dmgs = (
  await Promise.all(
    dirs.map(async (dir) => (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".dmg")).map((item) => path.join(dir, item))),
  )
).flat()
const dmg = dmgArg ?? (dmgs.length === 1 ? dmgs[0]! : undefined)
if (!dmg) throw new Error(`Expected exactly one DMG in ${dirs.join(", ")}; found ${dmgs.length}`)

const image = path.resolve(dmg)

if (profile) {
  await $`xcrun notarytool submit ${image} --keychain-profile ${profile} --wait`
} else {
  const missing = [
    ["APPLE_ID", Bun.env.APPLE_ID],
    ["APPLE_PASSWORD", Bun.env.APPLE_PASSWORD],
    ["APPLE_TEAM_ID", Bun.env.APPLE_TEAM_ID],
  ].filter((item) => !item[1])
  if (missing.length > 0) throw new Error(`Missing notarization env: ${missing.map((item) => item[0]).join(", ")}`)
  await $`xcrun notarytool submit ${image} --apple-id ${Bun.env.APPLE_ID!} --password ${Bun.env.APPLE_PASSWORD!} --team-id ${Bun.env.APPLE_TEAM_ID!} --wait`
}

await $`xcrun stapler staple ${image}`
await $`xcrun stapler validate ${image}`

console.log(`Notarized and stapled macOS DMG ${image}`)
