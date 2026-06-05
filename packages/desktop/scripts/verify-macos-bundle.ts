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
const strict = args.includes("--require-developer-id")
if (!target && !appArg) throw new Error("Missing --app, --target or RUST_TARGET")
if (target && !target.includes("apple-darwin")) throw new Error(`macOS bundle verification is not available for ${target}`)

const exists = async (file: string) => Boolean(await stat(file).catch(() => undefined))
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
    dirs.map(async (dir) => (await readdir(dir).catch(() => [])).filter((item) => item.endsWith(".app")).map((item) => path.join(dir, item))),
  )
).flat()
const fallback = dirs.map((dir) => path.join(dir, `${name}.app`))
const app = appArg ?? (apps.length === 1 ? apps[0]! : (await first(fallback)) ?? fallback[0] ?? "")
const contents = path.join(app, "Contents")
const macos = path.join(contents, "MacOS")
const plist = path.join(contents, "Info.plist")
const dist = path.resolve("dist")
const executable = config.mainBinaryName ?? "railwise"
const bin = path.join(macos, executable)
const sidecar = path.join(macos, "railwise-cli")
const arch = target?.startsWith("aarch64-") ? "arm64" : target?.startsWith("x86_64-") ? "x86_64" : undefined
const mac = (text: string) => (arch ? text.includes(`executable ${arch}`) : /Mach-O 64-bit executable (arm64|x86_64)/.test(text))
const native = !arch || arch === process.arch || (arch === "x86_64" && process.arch === "x64")
const tail = (value: string) => value.split("\n").slice(-24).join("\n")
const files = async (dir: string): Promise<string[]> => {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => [])
  return (
    await Promise.all(
      entries.map((item) => {
        const file = path.join(dir, item.name)
        if (item.isDirectory()) return files(file)
        return [file]
      }),
    )
  ).flat()
}

const field = async (name: string) => (await $`/usr/libexec/PlistBuddy -c ${`Print :${name}`} ${plist}`.text()).trim()
const optional = async (name: string) => {
  const result = await $`/usr/libexec/PlistBuddy -c ${`Print :${name}`} ${plist}`.quiet().nothrow()
  if (result.exitCode !== 0) return undefined
  return result.stdout.toString().trim()
}
const filetype = async (file: string) => (await $`file ${file}`.text()).trim()
const binaryStrings = async (file: string) => (await $`strings ${file}`.text()).trim()
const signature = async (file: string) => {
  const result = await $`codesign -dv --verbose=4 ${file}`.quiet().nothrow()
  const text = result.stdout.toString() + result.stderr.toString()
  return {
    developer: text.includes("Authority=Developer ID Application:"),
    runtime: text.includes("Runtime Version=") || text.includes("flags=0x10000(runtime)"),
    timestamp: text.includes("Timestamp="),
  }
}

check("app bundle exists", (await stat(app).catch(() => undefined))?.isDirectory() === true, app)
check("Info.plist exists", await exists(plist), plist)
check("main executable exists", await exists(bin), bin)
check("sidecar exists", await exists(sidecar), sidecar)

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

if (await exists(bin)) {
  const frontend = (await files(dist)).filter((file) => /\.(html|js|css)$/.test(file))
  const source = (await Promise.all(frontend.map((file) => Bun.file(file).text()))).join("\n")
  const home = frontend
    .map((file) => path.relative(dist, file))
    .find((file) => /^assets\/home-[\w-]+\.js$/.test(file))
  const embedded = await binaryStrings(bin)
  const legacy = ["项目驾驶舱", "多智能体协作中枢", "智能体矩阵", "睿威总控", "总工程师", "项目工作区", "Agent Studio"]

  check(
    "frontend dist current home workbench",
    source.includes("想让 RAILWISE 完成什么？") &&
      source.includes("home-workbench") &&
      source.includes("home-empty-sessions") &&
      source.includes("输入任务会创建第一条会话。") &&
      source.includes("先打开项目，再开始协作。") &&
      source.includes("DeepSeek V4") &&
      source.includes("home-connect-model") &&
      source.includes("接入 DeepSeek") &&
      source.includes("能力市场") &&
      source.includes("执行中心"),
    "dist must contain the current minimal RAILWISE workbench",
  )
  check(
    "frontend dist blocks legacy desktop UI",
    legacy.every((item) => !source.includes(item)),
    "dist must not contain legacy dashboard, map, or old management copy",
  )
  check(
    "embedded frontend home chunk",
    Boolean(home && embedded.includes(`/${home}`)),
    home ? `embedded /${home}` : "missing dist/assets/home-*.js",
  )
}

if (await exists(sidecar)) {
  check("sidecar architecture", mac(await filetype(sidecar)), arch ?? "arm64 or x86_64")
  if (native) {
    const result = await $`bun ./scripts/verify-sidecar-legacy-config.ts --bin ${sidecar}`.quiet().nothrow()
    check(
      "sidecar legacy config compatibility",
      result.exitCode === 0,
      result.exitCode === 0
        ? result.stdout.toString().trim().split("\n").at(-1) ?? "passed"
        : tail(`${result.stdout.toString()}\n${result.stderr.toString()}`),
    )
  } else {
    check("sidecar legacy config compatibility", true, `skipped for non-native ${arch} sidecar on ${process.arch}`)
  }
}

try {
  await $`codesign --verify --deep --strict --verbose=4 ${app}`
  check("codesign strict verification", true, "valid on disk and satisfies Designated Requirement")
} catch (err) {
  check("codesign strict verification", false, err instanceof Error ? err.message : String(err))
}

if (strict) {
  const appSig = await signature(app)
  check("app Developer ID signature", appSig.developer, "Authority=Developer ID Application")
  check("app secure timestamp", appSig.timestamp, "Timestamp must be present")
  check("app hardened runtime", appSig.runtime, "Runtime Version must be present")
  if (await exists(sidecar)) {
    const sidecarSig = await signature(sidecar)
    check("sidecar Developer ID signature", sidecarSig.developer, "Authority=Developer ID Application")
    check("sidecar secure timestamp", sidecarSig.timestamp, "Timestamp must be present")
    check("sidecar hardened runtime", sidecarSig.runtime, "Runtime Version must be present")
  }
}

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} macOS bundle check(s) failed.`)
  process.exit(1)
}

console.log(`\nmacOS bundle verification passed (${checks.length} checks).`)
