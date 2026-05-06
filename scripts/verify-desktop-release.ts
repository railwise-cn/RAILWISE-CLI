#!/usr/bin/env bun

import path from "node:path"

type Config = {
  productName?: string
  identifier?: string
  mainBinaryName?: string
  bundle?: {
    createUpdaterArtifacts?: boolean
    icon?: string[]
    windows?: {
      nsis?: {
        installerIcon?: string
        headerImage?: string
        sidebarImage?: string
        displayLanguageSelector?: boolean
        languages?: string[]
        installMode?: string
        startMenuFolder?: string
      }
    }
    macOS?: {
      entitlements?: string
      dmg?: {
        background?: string
        windowSize?: { width?: number; height?: number }
        appPosition?: { x?: number; y?: number }
        applicationFolderPosition?: { x?: number; y?: number }
      }
    }
    linux?: {
      deb?: {
        depends?: string[]
        section?: string
        files?: Record<string, string>
      }
      rpm?: {
        compression?: {
          type?: string
        }
      }
    }
  }
  plugins?: {
    updater?: {
      pubkey?: string
      endpoints?: string[]
      windows?: {
        installMode?: string
      }
    }
  }
}

const root = path.resolve(import.meta.dir, "..")
const checks: { name: string; passed: boolean; detail: string }[] = []
const file = (...parts: string[]) => path.join(root, ...parts)
const read = async (...parts: string[]) => Bun.file(file(...parts)).text()
const exists = async (...parts: string[]) => Bun.file(file(...parts)).exists()
const contains = (text: string, values: string[]) => values.every((value) => text.includes(value))
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const workflowPath = ".github/workflows/desktop-release.yml"
const configPath = "packages/desktop/src-tauri/tauri.prod.conf.json"
const workflowExists = await exists(workflowPath)
const configExists = await exists(configPath)
const workflow = workflowExists ? await read(workflowPath) : ""
const sidecar = await read("packages/desktop/scripts/utils.ts")
const config = configExists ? ((await Bun.file(file(configPath)).json()) as Config) : {}
const cli = await read("packages/desktop/src-tauri/src/cli.rs")
const lib = await read("packages/desktop/src-tauri/src/lib.rs")
const dialog = await read("packages/desktop/src/components/update-dialog.tsx")
const targets = ["x86_64-pc-windows-msvc", "aarch64-apple-darwin", "x86_64-apple-darwin"]
const secrets = [
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_KEYCHAIN_PASSWORD",
  "APPLE_ID",
  "APPLE_ID_PASSWORD",
  "APPLE_TEAM_ID",
  "APPLE_SIGNING_IDENTITY",
  "WINDOWS_CERTIFICATE",
  "WINDOWS_CERTIFICATE_PASSWORD",
]
const linux = ["x86_64-unknown-linux-gnu", "libwebkit2gtk-4.1-dev", 'matrix.platform == "linux"', "matrix.platform == 'linux'"]
const assets = [
  ...(config.bundle?.icon ?? []),
  config.bundle?.windows?.nsis?.installerIcon,
  config.bundle?.windows?.nsis?.headerImage,
  config.bundle?.windows?.nsis?.sidebarImage,
  config.bundle?.macOS?.entitlements,
  config.bundle?.macOS?.dmg?.background,
  ...Object.values(config.bundle?.linux?.deb?.files ?? {}),
].filter((item): item is string => Boolean(item))
const missingTargets = targets.filter((target) => !workflow.includes(target))
const missingSecrets = secrets.filter((secret) => !workflow.includes(secret))
const missingAssets = (
  await Promise.all(
    assets.map(async (asset) => {
      const target = path.join("packages/desktop/src-tauri", asset)
      return (await exists(target)) ? undefined : target
    }),
  )
).filter((item): item is string => Boolean(item))
const pubkey = config.plugins?.updater?.pubkey ?? ""
const endpoint = "https://updates.railwise.cn/desktop/{{target}}/{{current_version}}"

check("release workflow exists", workflowExists, workflowPath)
check(
  "release triggers",
  contains(workflow, ['"desktop/v*"', "workflow_dispatch:", "version:"]),
  "desktop/v* tags and manual version input",
)
check(
  "release target matrix",
  missingTargets.length === 0,
  missingTargets.length === 0 ? targets.join(", ") : `missing: ${missingTargets.join(", ")}`,
)
check(
  "release bundle matrix",
  contains(workflow, ["bundles: nsis", "bundles: dmg", "--bundles ${{ matrix.bundles }}"]) &&
    !workflow.includes("-name \"*.msi\""),
  "Windows builds only NSIS; macOS builds only DMG",
)
check(
  "release omits Linux target",
  linux.every((item) => !workflow.includes(item)) && !sidecar.includes("linux-"),
  "Beta release builds Windows x64, macOS Apple Silicon, and macOS Intel only",
)
check(
  "Windows sidecar uses standard x64",
  sidecar.includes('rustTarget: "x86_64-pc-windows-msvc"') &&
    sidecar.includes('ocBinary: "railwise-windows-x64"') &&
    !sidecar.includes("railwise-windows-x64-baseline"),
  "Windows Beta publishes one standard 64-bit installer without Bun baseline dependency",
)
check(
  "release signing env",
  missingSecrets.length === 0,
  missingSecrets.length === 0
    ? "Tauri, macOS, and Windows signing secrets are referenced"
    : `missing: ${missingSecrets.join(", ")}`,
)
check(
  "Windows direct signing",
  contains(workflow, [
    "Sign Windows Installer (signtool)",
    "WINDOWS_CERTIFICATE",
    "WINDOWS_CERTIFICATE_PASSWORD",
    "signtool.exe",
    "sign /f",
    "verify /pa /v",
    "http://timestamp.digicert.com",
  ]) &&
    !workflow.includes("signpath/github-action-submit-signing-request") &&
    !workflow.includes("SIGNPATH_"),
  "Windows NSIS installer is signed directly with signtool and a GitHub Actions certificate secret",
)
check(
  "release build command",
  contains(workflow, [
    "working-directory: packages/desktop",
    "bun run predev -- --target",
    "bun run tauri -- build",
    "--bundles ${{ matrix.bundles }}",
    "--config src-tauri/tauri.prod.conf.json",
  ]),
  "production Tauri config is used and Bun forwards target/bundle release arguments",
)
check(
  "release public installer coverage",
  contains(workflow, [
    "merge-multiple: false",
    'railwise-desktop-*-signed/*.exe',
    '-name "*.dmg"',
    "Expected exactly 3 public installers",
    "--draft",
    '--target "$GITHUB_SHA"',
  ]) &&
    !workflow.includes('-name "*.tar.gz"') &&
    !workflow.includes('-name "*.zip"'),
  "draft release uploads the signed Windows x64 installer and two macOS DMGs only",
)
check("production config exists", configExists, configPath)
check(
  "production identity",
  config.productName === "睿威智测 RAILWISE" &&
    config.identifier === "com.railwiseai.desktop" &&
    config.mainBinaryName === "railwise",
  `${config.productName ?? "missing"} / ${config.identifier ?? "missing"} / ${config.mainBinaryName ?? "missing"}`,
)
check(
  "updater config",
  config.bundle?.createUpdaterArtifacts === true &&
    config.plugins?.updater?.endpoints?.includes(endpoint) === true &&
    pubkey.length > 64 &&
    !pubkey.toLowerCase().includes("placeholder"),
  endpoint,
)
check(
  "Windows installer config",
  config.bundle?.windows?.nsis?.headerImage === "assets/nsis-header-railwise.bmp" &&
    config.bundle?.windows?.nsis?.sidebarImage === "assets/nsis-sidebar-railwise.bmp" &&
    config.bundle?.windows?.nsis?.installMode === "currentUser" &&
    config.bundle?.windows?.nsis?.languages?.includes("SimpChinese") === true,
  "NSIS uses RAILWISE artwork, SimpChinese, and current-user install mode",
)
check(
  "macOS bundle config",
  config.bundle?.macOS?.entitlements === "./entitlements.plist" &&
    config.bundle?.macOS?.dmg?.background === "assets/dmg-background.png" &&
    Boolean(config.bundle?.macOS?.dmg?.appPosition) &&
    Boolean(config.bundle?.macOS?.dmg?.applicationFolderPosition),
  "DMG artwork, entitlements, and icon positions are configured",
)
check(
  "release assets",
  missingAssets.length === 0,
  missingAssets.length === 0 ? `${assets.length} referenced assets exist` : `missing: ${missingAssets.join(", ")}`,
)
check(
  "CLI install command",
  contains(cli, [
    "#[tauri::command]",
    "pub fn install_cli",
    'CLI_BINARY_NAME: &str = "railwise"',
    'CLI_BINARY_NAME: &str = "railwise.exe"',
    'CLI_INSTALL_DIR: &str = ".railwise/bin"',
  ]) && lib.includes("cli::install_cli"),
  "install_cli installs the railwise binary and is registered with Tauri",
)
check(
  "update dialog",
  contains(dialog, ['data-testid="update-dialog"', 'data-testid="update-install-btn"', "立即更新", "稍后提醒"]),
  "desktop update dialog exposes the install action and test hooks",
)

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} desktop release readiness check(s) failed.`)
  process.exit(1)
}

console.log(`\nDesktop M6 release readiness passed (${checks.length} checks).`)
