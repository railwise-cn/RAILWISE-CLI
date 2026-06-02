#!/usr/bin/env bun

import path from "node:path"

type Config = {
  build?: {
    devUrl?: string
  }
  productName?: string
  identifier?: string
  mainBinaryName?: string
  bundle?: {
    createUpdaterArtifacts?: boolean
    targets?: string[] | string
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
const bundleTargets = (value: unknown) => (Array.isArray(value) ? value : value ? [value] : []).map(String)
const check = (name: string, passed: boolean, detail: string) => checks.push({ name, passed, detail })

const workflowPath = ".github/workflows/desktop-release.yml"
const configPath = "packages/desktop/src-tauri/tauri.prod.conf.json"
const devConfigPath = "packages/desktop/src-tauri/tauri.conf.json"
const workflowExists = await exists(workflowPath)
const configExists = await exists(configPath)
const workflow = workflowExists ? await read(workflowPath) : ""
const sidecar = await read("packages/desktop/scripts/utils.ts")
const config = configExists ? ((await Bun.file(file(configPath)).json()) as Config) : {}
const devConfig = (await Bun.file(file(devConfigPath)).json()) as Config
const vite = await read("packages/desktop/vite.config.ts")
const predev = await read("packages/desktop/scripts/predev.ts")
const pkg = (await Bun.file(file("packages/desktop/package.json")).json()) as { scripts?: Record<string, string> }
const macSign = await read("packages/desktop/scripts/sign-macos-app.ts")
const railwiseBuild = await read("packages/railwise/script/build.ts")
const railwiseModels = await read("packages/railwise/script/models.ts")
const cli = await read("packages/desktop/src-tauri/src/cli.rs")
const lib = await read("packages/desktop/src-tauri/src/lib.rs")
const dialog = await read("packages/desktop/src/components/update-dialog.tsx")
const adminDeploy = await read("docs/admin/01-deploy.md")
const targets = ["aarch64-apple-darwin", "x86_64-apple-darwin"]
const secrets = [
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
  "APPLE_KEYCHAIN_PASSWORD",
  "APPLE_SIGNING_IDENTITY",
  "APPLE_ID",
  "APPLE_ID_PASSWORD",
  "APPLE_TEAM_ID",
]
const notarization = [
  "APPLE_ID: ${{ secrets.APPLE_ID }}",
  "APPLE_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}",
  "APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}",
]
const linux = ["x86_64-unknown-linux-gnu", "libwebkit2gtk-4.1-dev", 'matrix.platform == "linux"', "matrix.platform == 'linux'"]
const desktopTargets = ["dmg", "nsis"]
const windows = [
  "windows-2022",
  "x86_64-pc-windows-msvc",
  "bundles: nsis",
  "Sign Windows Installer",
  "WINDOWS_CERTIFICATE",
  "WINDOWS_CERTIFICATE_PASSWORD",
  "signtool.exe",
  "railwise-desktop-*-signed",
]
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
  "release macOS runners",
  workflow.includes("os: macos-14") && workflow.includes("os: macos-15-intel") && !workflow.includes("os: macos-13"),
  "Apple Silicon uses macos-14 and Intel uses the current macos-15-intel runner",
)
check(
  "release bundle matrix",
  contains(workflow, ["bundles: dmg", "--bundles ${{ matrix.bundles }}"]) &&
    !workflow.includes("bundles: nsis") &&
    !workflow.includes("-name \"*.msi\""),
  "Beta release builds macOS DMG bundles only",
)
check(
  "release omits Linux target",
  linux.every((item) => !workflow.includes(item)) &&
    !sidecar.includes("linux-") &&
    !adminDeploy.includes("Linux 安装包") &&
    !adminDeploy.includes("linux/"),
  "Desktop release excludes Linux installers and deployment docs do not promise Linux packages",
)
check(
  "desktop bundle targets",
  [config.bundle?.targets, devConfig.bundle?.targets].every((value) => {
    const targets = bundleTargets(value)
    return (
      targets.length === desktopTargets.length &&
      desktopTargets.every((item) => targets.includes(item)) &&
      targets.every((item) => desktopTargets.includes(item))
    )
  }),
  "Tauri configs only allow DMG and NSIS desktop installers",
)
check(
  "release omits Windows target",
  windows.every((item) => !workflow.includes(item)),
  "Windows publishing is paused until a Windows code-signing certificate is purchased",
)
check(
  "release signing env",
  missingSecrets.length === 0,
  missingSecrets.length === 0
    ? "Tauri, macOS signing, and notarization secrets are referenced"
    : `missing: ${missingSecrets.join(", ")}`,
)
check(
  "release enables macOS notarization",
  notarization.every((item) => workflow.includes(item)) && workflow.includes("timeout-minutes: 45"),
  "Beta release keeps public macOS DMGs notarized while allowing Intel release compilation",
)
check(
  "release requires macOS signing",
  contains(workflow, [
    "Require macOS signing secrets",
    "steps.signing.outputs.macos != 'true'",
    "Public RAILWISE Desktop macOS releases require Developer ID signing and notarization secrets.",
  ]),
  "Public macOS beta releases fail fast instead of publishing unsigned DMGs",
)
check(
  "release keychain grants codesign",
  contains(workflow, [
    "security set-keychain-settings -lut 21600 build.keychain",
    "-T /usr/bin/codesign -T /usr/bin/pkgbuild -T /usr/bin/productbuild",
    "security set-key-partition-list -S apple-tool:,apple:,codesign:",
    "security find-identity -v -p codesigning build.keychain",
  ]),
  "macOS CI keychain grants non-interactive codesign access",
)
check(
  "release build command",
  contains(workflow, [
    "working-directory: packages/desktop",
    "bun run predev -- --target",
    'Bun.file("src-tauri/tauri.prod.conf.json").json()',
    'Bun.write("src-tauri/tauri.ci.conf.json"',
    "bun run tauri -- build",
    "--bundles ${{ matrix.bundles }}",
    "--config src-tauri/tauri.ci.conf.json",
  ]),
  "production Tauri config is converted to CI config and Bun forwards target/bundle release arguments",
)
check(
  "release verifies macOS app signature",
  contains(workflow, [
    "Verify macOS bundle signature",
    'codesign --verify --deep --strict --verbose=4 "$APP"',
    "bundle/macos/睿威智测 RAILWISE.app",
  ]),
  "CI verifies the sealed app bundle before uploading release artifacts",
)
check(
  "desktop dev loopback host",
  devConfig.build?.devUrl === "http://127.0.0.1:1420" && vite.includes('host: host || "127.0.0.1"'),
  "development startup avoids localhost DNS resolution and binds Vite to loopback IP",
)
check(
  "sidecar build can skip dependency reinstall",
  contains(predev, ["RAILWISE_SKIP_INSTALL", "--skip-install", "bun run build --single --skip-install"]),
  "local desktop verification can refresh the sidecar in restricted environments",
)
check(
  "local macOS ad-hoc signing script",
  pkg.scripts?.["sign:macos"] === "bun ./scripts/sign-macos-app.ts" &&
    contains(macSign, [
      "APPLE_SIGNING_IDENTITY",
      "codesign --force --deep --sign -",
      "codesign --verify --deep --strict --verbose=4",
      "apple-darwin",
    ]),
  "Local macOS app bundles can be sealed with ad-hoc signing when Developer ID is unavailable",
)
check(
  "sidecar build reuses models snapshot offline",
  contains(railwiseBuild, ["models(dir)", "modelsSource(modelsData)"]) &&
    contains(railwiseModels, [
      "MODELS_DEV_API_JSON",
      "src/provider/models-snapshot.ts",
      "test/tool/fixtures/models-api.json",
      "handled: true",
    ]),
  "CLI build can seed or reuse models snapshot when models.dev is temporarily unreachable",
)
check(
  "release public installer coverage",
  contains(workflow, [
    "merge-multiple: false",
    '-name "*.dmg"',
    "Expected exactly 2 public macOS installers",
    '--repo "$GITHUB_REPOSITORY"',
    "--draft",
    'gh release delete "$TAG"',
    '--target "$GITHUB_SHA"',
  ]) &&
    !workflow.includes('-name "*.exe"') &&
    !workflow.includes('-name "*.tar.gz"') &&
    !workflow.includes('-name "*.zip"'),
  "draft release uploads macOS Apple Silicon and Intel DMGs only",
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
