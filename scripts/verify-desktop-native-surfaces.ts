#!/usr/bin/env bun

import path from "node:path"

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const has = (text: string, values: string[]) => values.every((value) => text.includes(value))
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const win = await read("packages/desktop/src-tauri/src/windows.rs")
const lib = await read("packages/desktop/src-tauri/src/lib.rs")
const menu = await read("packages/desktop/src/menu.ts")
const index = await read("packages/desktop/src/index.tsx")
const updater = await read("packages/desktop/src/updater.ts")
const updateSpec = await read("packages/desktop/e2e/09-update-flow.spec.ts")
const recoverySpec = await read("packages/desktop/e2e/10-crash-recovery.spec.ts")
const workflowSpec = await read("packages/desktop/e2e/05-workflow-pipeline.spec.ts")
const smoke = await read("packages/desktop/scripts/native-smoke.ts")

check(
  "native window bootstrap",
  has(win, [
    'WebviewUrl::App("/#/dashboard".into())',
    '.title("RAILWISE")',
    ".visible(true)",
    ".maximized(true)",
    "setup_window_state_listener",
    "window.__RAILWISE__.updatesEnabled",
    "window.__RAILWISE__.wsl",
  ]),
  "main window opens dashboard, restores native state, and injects desktop-only flags",
)

check(
  "native menu commands",
  has(menu, [
    'ostype() !== "macos"',
    "Menu.new",
    "runUpdater({ alertOnFail: true })",
    "installCli()",
    "commands.killSidecar()",
    "relaunch()",
    'trigger("session.new")',
    'trigger("project.open")',
    "openUrl(DOCS_URL)",
    "openUrl(BUG_URL)",
  ]),
  "macOS app menu wires update, CLI install, restart, session, project, docs, and bug actions",
)

check(
  "native local file surface",
  has(index, [
    "openDirectoryPickerDialog",
    "openFilePickerDialog",
    "saveFilePickerDialog",
    "openPath(path: string, app?: string)",
    "openerOpenPath",
    'commands.wslPath(path, "windows")',
    "handleWslPicker",
  ]),
  "desktop platform owns native file pickers, save dialog, open path, and WSL path conversion",
)

check(
  "native updater surface",
  has(updater, [
    "window.__RAILWISE__?.updatesEnabled",
    "await check()",
    "await update.download()",
    'if (ostype() === "windows") await commands.killSidecar()',
    "await update.install()",
    "await commands.killSidecar()",
    "await relaunch()",
  ]) && has(index, ["checkUpdate: async () =>", "update: async () =>", "await installUpdate(update.update)"]),
  "updater is gated by native flag, downloads through Tauri updater, kills sidecar, installs, and relaunches",
)

check(
  "browser harness coverage remains explicit",
  has(updateSpec, ["rw_mock_update_available", "[data-testid=update-dialog]", "[data-testid=update-install-btn]"]) &&
    has(recoverySpec, ["rw_kill_sidecar_for_test", "[data-testid=sidecar-status]", '"restarting"', '"ready"']) &&
    has(workflowSpec, [
      "[data-testid=workflow-delivery-archive]",
      "[data-testid=workflow-delivery-file-list]",
      "交付清单 JSON",
    ]),
  "browser E2E covers update dialog, crash recovery indicator, and delivery file list while native gates cover shell wiring",
)

check(
  "native smoke evidence",
  has(smoke, [
    "cargo build",
    '"src-tauri", "target", "debug", "railwise"',
    "src-tauri/sidecars/railwise-cli",
    "/global/health",
    "RAILWISE_NATIVE_SMOKE",
    "waitForOutput",
    "railwise-native-smoke:app.initializing",
    "railwise-native-smoke:windows.bootstrap.ready",
    "railwise-native-smoke:sidecar.spawn_requested",
    "railwise-native-smoke:sidecar.health_ok",
    "railwise-native-smoke:main_window.visible",
    "railwise-native-smoke:app.initialized",
    "Native Tauri smoke passed",
  ]) &&
    has(lib, [
      "fn native_smoke_marker",
      'native_smoke_marker("app.initializing")',
      'native_smoke_marker("windows.bootstrap.ready")',
      'native_smoke_marker("sidecar.spawn_requested")',
      'native_smoke_marker("sidecar.health_ok")',
      'native_smoke_marker("main_window.visible")',
      'native_smoke_marker("app.initialized")',
    ]),
  "native smoke builds and launches the debug app with temporary sidecar health and lifecycle evidence",
)

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} native desktop surface check(s) failed.`)
  process.exit(1)
}

console.log(`\nDesktop native surface readiness passed (${checks.length} checks).`)
