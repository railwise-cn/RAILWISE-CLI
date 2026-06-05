#!/usr/bin/env bun

import { $ } from "bun"
import { mkdir, readdir, rm, stat } from "node:fs/promises"
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
const checksum = arg("--checksum", `${zip}.sha256`)!
const dest = arg("--dest", path.join("src-tauri", "target", "release", "local-app"))!
const skipOpen = args.includes("--skip-open")
const zipPath = path.resolve(zip)
const checksumPath = path.resolve(checksum)
const destPath = path.resolve(dest)

if ((await stat(zipPath).catch(() => undefined))?.isFile() !== true) throw new Error(`App zip not found: ${zipPath}`)
if ((await stat(checksumPath).catch(() => undefined))?.isFile() !== true) throw new Error(`Checksum not found: ${checksumPath}`)

await $`shasum -a 256 -c ${checksumPath}`.cwd(path.dirname(zipPath))
await rm(destPath, { recursive: true, force: true })
await mkdir(destPath, { recursive: true })
await $`ditto -x -k ${zipPath} ${destPath}`

const apps = (await readdir(destPath)).filter((item) => item.endsWith(".app"))
if (apps.length !== 1) throw new Error(`Expected exactly one app under ${destPath}; found ${apps.length}`)

const app = path.join(destPath, apps[0])
await $`bun ./scripts/verify-macos-bundle.ts --app ${app}`

if (skipOpen) {
  console.log(`Prepared local macOS app ${app}`)
  process.exit(0)
}

const opened = await $`open -n ${app}`.nothrow()
if (opened.exitCode !== 0) {
  const message = `${opened.stderr}\n${opened.stdout}`.trim()
  const launchServicesNote = message.includes("kLSNoExecutableErr")
    ? "LaunchServices reported kLSNoExecutableErr after bundle verification. The app executable exists; this usually means the current shell cannot use macOS graphical launch services."
    : "The app bundle was verified before launch."
  throw new Error(
    [
      `Failed to open local macOS app: ${app}`,
      message,
      launchServicesNote,
      "If this shell is sandboxed, rerun with --skip-open here and open the app from Finder or a normal macOS Terminal.",
      `Normal Terminal command: cd ${process.cwd()} && bun run open:macos:local`,
    ].join("\n"),
  )
}

console.log(`Opened local macOS app ${app}`)
