#!/usr/bin/env bun

import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const exists = async (...parts: string[]) => Bun.file(file(...parts)).exists()
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const bundleTargets = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []).map(String)
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const workflowPath = ".github/workflows/desktop-windows-internal.yml"
const workflow = (await exists(workflowPath)) ? await read(workflowPath) : ""
const release = await read(".github/workflows/desktop-release.yml")
const config = await Bun.file(file("packages/desktop/src-tauri/tauri.prod.conf.json")).json()
const dev = await Bun.file(file("packages/desktop/src-tauri/tauri.conf.json")).json()
const lib = await read("packages/desktop/src-tauri/src/lib.rs")
const cargo = await read("packages/desktop/src-tauri/Cargo.toml")
const bindings = await read("packages/desktop/src/bindings.ts")

check("workflow exists", Boolean(workflow), workflowPath)
check(
  "manual internal trigger",
  has(workflow, ["workflow_dispatch:", "version:", "Internal build label"]),
  "workflow is manually triggered with an internal build label",
)
check(
  "windows-only runner",
  has(workflow, ["runs-on: windows-2022", "x86_64-pc-windows-msvc"]) &&
    !workflow.includes("macos-") &&
    !workflow.includes("ubuntu-"),
  "builds only one Windows 64-bit installer",
)
check(
  "unsigned internal build",
  has(workflow, ["Build unsigned Windows installer", "--bundles nsis"]) &&
    !workflow.includes("WINDOWS_CERTIFICATE") &&
    !workflow.includes("WINDOWS_CERTIFICATE_PASSWORD") &&
    !workflow.includes("signtool.exe"),
  "does not require paid Windows code-signing secrets",
)
check(
  "production tauri config",
  has(workflow, [
    "working-directory: packages/desktop",
    "bun run predev -- --target x86_64-pc-windows-msvc",
    "bun run tauri -- build --target x86_64-pc-windows-msvc",
    "--config src-tauri/tauri.prod.conf.json",
  ]),
  "uses the same production desktop config and sidecar path",
)
check(
  "internal artifact only",
  has(workflow, [
    "actions/upload-artifact@v4",
    "railwise-desktop-windows-x64-internal",
    "release/bundle/nsis/*.exe",
    "retention-days: 14",
  ]) && !workflow.includes("gh release create"),
  "uploads an internal installer artifact instead of publishing a release",
)
check(
  "public release remains macOS-only",
  has(release, ['-name "*.dmg"', "Expected exactly 2 public macOS installers"]) &&
    !release.includes('-name "*.exe"') &&
    !release.includes("windows-2022") &&
    !release.includes("WINDOWS_CERTIFICATE"),
  "formal Desktop Release still publishes only the two notarized macOS DMGs",
)
check(
  "linux desktop packages disabled",
  config.bundle?.linux === undefined &&
    dev.bundle?.linux === undefined &&
    [config.bundle?.targets, dev.bundle?.targets].every((value) => {
      const targets = bundleTargets(value)
      return targets.length === 2 && targets.includes("dmg") && targets.includes("nsis")
    }) &&
    !release.includes("platform: linux") &&
    !release.includes("unknown-linux") &&
    !release.includes("bundles: deb") &&
    !release.includes("bundles: rpm"),
  "desktop distribution is limited to macOS public release plus Windows internal testing",
)
check(
  "linux native runtime removed",
  !lib.includes('target_os = "linux"') &&
    !lib.includes("LinuxDisplayBackend") &&
    !cargo.includes('cfg(target_os = "linux")') &&
    !bindings.includes("setDisplayBackend") &&
    !(await exists("packages/desktop/src-tauri/src/linux_display.rs")) &&
    !(await exists("packages/desktop/src-tauri/src/linux_windowing.rs")),
  "Desktop native runtime no longer carries Linux/Wayland commands or modules",
)
check(
  "windows installer config",
  config.bundle?.windows?.nsis?.installerIcon === "icons/railwise/icon.ico" &&
    config.bundle?.windows?.nsis?.headerImage === "assets/nsis-header-railwise.bmp" &&
    config.bundle?.windows?.nsis?.sidebarImage === "assets/nsis-sidebar-railwise.bmp" &&
    config.bundle?.windows?.nsis?.languages?.includes("SimpChinese") === true,
  "NSIS installer uses RAILWISE artwork and Simplified Chinese",
)

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length) {
  console.error(`\n${failed.length} Windows internal installer check(s) failed.`)
  process.exit(1)
}

console.log(`\nWindows internal installer readiness passed (${checks.length} checks).`)
