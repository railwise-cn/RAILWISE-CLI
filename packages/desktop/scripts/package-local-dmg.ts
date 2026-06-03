#!/usr/bin/env bun

import { $ } from "bun"
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import os from "node:os"
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
const app = arg("--app", path.join("src-tauri", "target", "release", "bundle", "macos", `${name}.app`))!
const output = arg(
  "--output",
  path.join("src-tauri", "target", "release", "bundle", "dmg", `${name}_${pkg.version ?? "0.0.0"}_local_${arch}.dmg`),
)!
const zip = arg("--zip-output", output.replace(/\.dmg$/, ".app.zip"))!
const stage = await mkdtemp(path.join(os.tmpdir(), "railwise-local-dmg-"))

if ((await stat(app).catch(() => undefined))?.isDirectory() !== true) throw new Error(`App bundle not found: ${app}`)

try {
  if (!args.includes("--skip-sign")) await $`bun ./scripts/sign-macos-app.ts --app ${app}`

  await mkdir(path.dirname(output), { recursive: true })
  await $`ditto ${app} ${path.join(stage, path.basename(app))}`
  await $`ln -s /Applications ${path.join(stage, "Applications")}`
  let fallback = false
  try {
    await $`hdiutil create -ov -format UDZO -volname ${`${name} Local`} -srcfolder ${stage} ${output}`
  } catch (err) {
    if (args.includes("--require-dmg")) {
      throw new Error(
        [
          `Failed to create macOS DMG: ${output}`,
          "If hdiutil reports 'device not configured' or '设备未配置', run this command from a normal macOS Terminal or GitHub Actions instead of a sandboxed shell.",
          err instanceof Error ? err.message : String(err),
        ].join("\n"),
      )
    }
    await $`ditto -c -k --sequesterRsrc --keepParent ${app} ${zip}`
    if ((await stat(zip).catch(() => undefined))?.isFile() !== true)
      throw new Error(`Fallback app zip not created: ${zip}`)
    if (!args.includes("--skip-verify")) await $`bun ./scripts/verify-macos-appzip.ts --zip ${zip}`
    console.log(
      [
        `Packaged fallback macOS app zip ${zip}`,
        `DMG creation failed in this shell: ${output}`,
        "Run with --require-dmg from a normal macOS Terminal or GitHub Actions to force DMG packaging.",
        err instanceof Error ? err.message : String(err),
      ].join("\n"),
    )
    fallback = true
  }

  if (!fallback) {
    const files = await readdir(path.dirname(output))
    if (!files.includes(path.basename(output))) {
      throw new Error([`DMG not created: ${output}`, `Use fallback app zip output instead: ${zip}`].join("\n"))
    }

    if (!args.includes("--skip-verify")) await $`bun ./scripts/verify-macos-dmg.ts --dmg ${output}`

    console.log(`Packaged local macOS DMG ${output}`)
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}
