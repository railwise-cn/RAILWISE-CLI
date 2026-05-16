#!/usr/bin/env bun

import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const exists = async (...parts: string[]) => Bun.file(file(...parts)).exists()
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const workflowPath = ".github/workflows/desktop-release.yml"
const configPath = "packages/desktop/src-tauri/tauri.prod.conf.json"
const workflow = (await exists(workflowPath)) ? await read(workflowPath) : ""
const config = await Bun.file(file(configPath)).json()

check("release workflow exists", Boolean(workflow), workflowPath)
check(
  "windows internal input",
  has(workflow, ["windows_unsigned_internal", "仅 Windows 内测", "default: false"]),
  "manual release dispatch exposes an unsigned Windows internal switch",
)
check(
  "windows-only internal target",
  has(workflow, ["platform:", "- windows", "x86_64-pc-windows-msvc", "windows-2022"]),
  "manual platform=windows builds the single Windows x64 target",
)
check(
  "signpath skipped for internal",
  has(workflow, [
    "WINDOWS_UNSIGNED_INTERNAL",
    '[ "${{ matrix.platform }}" = "windows" ] && [ "$WINDOWS_UNSIGNED_INTERNAL" != "true" ]',
    "inputs.windows_unsigned_internal != true",
  ]),
  "internal Windows builds do not require SignPath secrets or signing steps",
)
check(
  "internal artifact",
  has(workflow, [
    "Upload internal unsigned Windows installer",
    "railwise-desktop-windows-x64-internal-${{ inputs.version }}",
    "release/bundle/nsis/*.exe",
    "retention-days: 14",
  ]),
  "internal build uploads a short-lived NSIS installer artifact",
)
check(
  "internal sidecar",
  has(workflow, [
    "Build internal Windows sidecar",
    "bun run build --single",
    "railwise-windows-x64/bin/railwise.exe",
    "railwise-cli-${{ matrix.target }}.exe",
  ]),
  "internal Windows builds use the standard x64 sidecar and avoid the baseline Bun download",
)
check(
  "release skipped for internal",
  has(workflow, [
    "Create draft release",
    "if: github.event_name != 'workflow_dispatch' || inputs.windows_unsigned_internal != true",
  ]),
  "unsigned internal installer is not published as a GitHub Release",
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
