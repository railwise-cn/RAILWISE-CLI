#!/usr/bin/env bun

import { $ } from "bun"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type Config = {
  identifier?: string
  mainBinaryName?: string
  productName?: string
}

const args = Bun.argv.slice(2)
const checks: { name: string; passed: boolean; detail: string }[] = []

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })
const target = arg("--target", Bun.env.RUST_TARGET ?? Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target) throw new Error("Missing --target or RUST_TARGET")
if (!target.includes("apple-darwin")) throw new Error(`macOS bundle verification is not available for ${target}`)

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const dir = path.join("src-tauri", "target", target, "release", "bundle", "macos")
const apps = (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".app"))
const fallback = path.join(dir, `${config.productName ?? "睿威智测 RAILWISE"}.app`)
const app = arg("--app", apps.length === 1 ? path.join(dir, apps[0]!) : fallback)
const contents = path.join(app, "Contents")
const macos = path.join(contents, "MacOS")
const plist = path.join(contents, "Info.plist")
const executable = config.mainBinaryName ?? "railwise"
const bin = path.join(macos, executable)
const sidecar = path.join(macos, "railwise-cli")
const arch = target.startsWith("aarch64-") ? "arm64" : "x86_64"

const exists = async (file: string) => Boolean(await stat(file).catch(() => undefined))
const field = async (name: string) => (await $`/usr/libexec/PlistBuddy -c ${`Print :${name}`} ${plist}`.text()).trim()
const filetype = async (file: string) => (await $`file ${file}`.text()).trim()

check("app bundle exists", (await stat(app).catch(() => undefined))?.isDirectory() === true, app)
check("Info.plist exists", await exists(plist), plist)
check("main executable exists", await exists(bin), bin)
check("sidecar exists", await exists(sidecar), sidecar)

if (await exists(plist)) {
  check("bundle identifier", (await field("CFBundleIdentifier")) === config.identifier, config.identifier ?? "missing")
  check("bundle executable", (await field("CFBundleExecutable")) === executable, executable)
  check("bundle name", (await field("CFBundleName")) === config.productName, config.productName ?? "missing")
}

if (await exists(bin)) {
  check("main executable architecture", (await filetype(bin)).includes(`executable ${arch}`), arch)
}

if (await exists(sidecar)) {
  check("sidecar architecture", (await filetype(sidecar)).includes(`executable ${arch}`), arch)
}

await $`codesign --verify --deep --strict --verbose=4 ${app}`
check("codesign strict verification", true, "valid on disk and satisfies Designated Requirement")

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} macOS bundle check(s) failed.`)
  process.exit(1)
}

console.log(`\nmacOS bundle verification passed (${checks.length} checks).`)
