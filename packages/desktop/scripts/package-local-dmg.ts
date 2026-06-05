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
const output = arg("--output", path.join("src-tauri", "target", "release", "bundle", "dmg", `${name}_${pkg.version ?? "0.0.0"}_local_${arch}.dmg`))!
const zip = arg("--zip-output", output.replace(/\.dmg$/, ".app.zip"))!
const identity = arg("--sign-identity", Bun.env.APPLE_SIGNING_IDENTITY?.trim())?.trim()
const strict = args.includes("--require-developer-id")
const stage = await mkdtemp(path.join(os.tmpdir(), "railwise-local-dmg-"))

if ((await stat(app).catch(() => undefined))?.isDirectory() !== true) throw new Error(`App bundle not found: ${app}`)

const signature = async () => {
  const result = await $`codesign -dv --verbose=4 ${app}`.quiet().nothrow()
  const text = result.stdout.toString() + result.stderr.toString()
  return {
    developer: text.includes("Authority=Developer ID Application:"),
  }
}

const sign = async () => {
  if (args.includes("--skip-sign")) return
  if (!identity && (await signature()).developer) {
    console.log(`Preserving existing Developer ID signature for ${app}`)
    return
  }
  if (identity) {
    await $`bun ./scripts/sign-macos-app.ts --app ${app} --identity ${identity}`
    return
  }
  await $`bun ./scripts/sign-macos-app.ts --app ${app}`
}

const checksum = async (artifact: string) => {
  const digest = (await $`shasum -a 256 ${artifact}`.text()).trim().split(/\s+/)[0]
  const file = `${artifact}.sha256`
  await Bun.write(file, `${digest}  ${path.basename(artifact)}\n`)
  console.log(`Wrote checksum ${file}`)
}

try {
  await sign()
  if (strict && !(await signature()).developer) {
    throw new Error(
      [
        `Developer ID signature required for ${app}`,
        "Pass --sign-identity 'Developer ID Application: ...' or set APPLE_SIGNING_IDENTITY.",
        "Use --skip-sign only when the app is already signed with Developer ID.",
      ].join("\n"),
    )
  }

  await mkdir(path.dirname(output), { recursive: true })
  await rm(output, { force: true })
  await rm(zip, { force: true })
  await rm(`${output}.sha256`, { force: true })
  await rm(`${zip}.sha256`, { force: true })
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
    if ((await stat(zip).catch(() => undefined))?.isFile() !== true) throw new Error(`Fallback app zip not created: ${zip}`)
    if (!args.includes("--skip-verify")) await $`bun ./scripts/verify-macos-appzip.ts --zip ${zip}`
    await checksum(zip)
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
      throw new Error(
        [
          `DMG not created: ${output}`,
          `Use fallback app zip output instead: ${zip}`,
        ].join("\n"),
      )
    }

    if (!args.includes("--skip-verify")) await $`bun ./scripts/verify-macos-dmg.ts --dmg ${output}`
    await checksum(output)

    console.log(`Packaged local macOS DMG ${output}`)
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}
