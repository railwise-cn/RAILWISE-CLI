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
const appArg = arg("--app")
const target = arg("--target", Bun.env.RUST_TARGET || Bun.env.TAURI_ENV_TARGET_TRIPLE)
if (!target && !appArg) throw new Error("Missing --app, --target or RUST_TARGET")
if (target && !target.includes("apple-darwin"))
  throw new Error(`macOS bundle verification is not available for ${target}`)

const exists = async (file: string) => Boolean(await stat(file).catch(() => undefined))
const executableFile = async (file: string) => Boolean(((await stat(file).catch(() => undefined))?.mode ?? 0) & 0o111)
const first = async (items: string[]) => {
  for (const item of items) {
    if (await exists(item)) return item
  }
}
const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const name = config.productName ?? "睿威智测 RAILWISE"
const dirs = target
  ? [
      path.join("src-tauri", "target", target, "release", "bundle", "macos"),
      path.join("src-tauri", "target", "release", "bundle", "macos"),
    ]
  : []
const apps = (
  await Promise.all(
    dirs.map(async (dir) =>
      (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".app")).map((item) => path.join(dir, item)),
    ),
  )
).flat()
const fallback = dirs.map((dir) => path.join(dir, `${name}.app`))
const app = appArg ?? (apps.length === 1 ? apps[0]! : ((await first(fallback)) ?? fallback[0] ?? ""))
const contents = path.join(app, "Contents")
const macos = path.join(contents, "MacOS")
const plist = path.join(contents, "Info.plist")
const executable = config.mainBinaryName ?? "railwise"
const bin = path.join(macos, executable)
const sidecar = path.join(macos, "railwise-cli")
const arch = target?.startsWith("aarch64-") ? "arm64" : target?.startsWith("x86_64-") ? "x86_64" : undefined
const mac = (text: string) =>
  arch ? text.includes(`executable ${arch}`) : /Mach-O 64-bit executable (arm64|x86_64)/.test(text)

const field = async (name: string) => (await $`/usr/libexec/PlistBuddy -c ${`Print :${name}`} ${plist}`.text()).trim()
const optional = async (name: string) => {
  const result = await $`/usr/libexec/PlistBuddy -c ${`Print :${name}`} ${plist}`.quiet().nothrow()
  if (result.exitCode !== 0) return undefined
  return result.stdout.toString().trim()
}
const filetype = async (file: string) => (await $`file ${file}`.text()).trim()

check("app bundle exists", (await stat(app).catch(() => undefined))?.isDirectory() === true, app)
check("Info.plist exists", await exists(plist), plist)
check("main executable exists", await exists(bin), bin)
check("sidecar exists", await exists(sidecar), sidecar)
check("main executable permission", await executableFile(bin), bin)
check("sidecar executable permission", await executableFile(sidecar), sidecar)

if (await exists(plist)) {
  check("bundle identifier", (await field("CFBundleIdentifier")) === config.identifier, config.identifier ?? "missing")
  check("bundle executable", (await field("CFBundleExecutable")) === executable, executable)
  check("bundle name", (await field("CFBundleName")) === config.productName, config.productName ?? "missing")
  check(
    "modern launch services plist",
    (await optional("LSRequiresCarbon")) !== "true" && (await optional("NSPrincipalClass")) === "NSApplication",
    "LSRequiresCarbon must not be true and NSPrincipalClass must be NSApplication",
  )
}

if (await exists(bin)) {
  check("main executable architecture", mac(await filetype(bin)), arch ?? "arm64 or x86_64")
}

if (await exists(sidecar)) {
  check("sidecar architecture", mac(await filetype(sidecar)), arch ?? "arm64 or x86_64")
}

try {
  await $`codesign --verify --deep --strict --verbose=4 ${app}`
  check("codesign strict verification", true, "valid on disk and satisfies Designated Requirement")
} catch (err) {
  check("codesign strict verification", false, err instanceof Error ? err.message : String(err))
}

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} macOS bundle check(s) failed.`)
  process.exit(1)
}

console.log(`\nmacOS bundle verification passed (${checks.length} checks).`)
