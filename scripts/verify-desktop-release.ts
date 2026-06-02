#!/usr/bin/env bun

import path from "node:path"

type Config = {
  build?: {
    beforeBuildCommand?: string
    beforeDevCommand?: string
    devUrl?: string
    frontendDist?: string
  }
  app?: {
    macOSPrivateApi?: boolean
    withGlobalTauri?: boolean
    windows?: {
      create?: boolean
      label?: string
    }[]
    security?: {
      csp?: string
    }
  }
  productName?: string
  identifier?: string
  mainBinaryName?: string
  bundle?: {
    createUpdaterArtifacts?: boolean
    active?: boolean
    externalBin?: string[]
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
      infoPlist?: string
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
    "deep-link"?: {
      desktop?: {
        schemes?: string[]
      }
    }
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
const prepare = await read("packages/desktop/scripts/prepare-tauri-config.ts")
const localDmg = await read("packages/desktop/scripts/package-local-dmg.ts")
const pkg = (await Bun.file(file("packages/desktop/package.json")).json()) as { scripts?: Record<string, string> }
const macSign = await read("packages/desktop/scripts/sign-macos-app.ts")
const macVerify = await read("packages/desktop/scripts/verify-macos-bundle.ts")
const dmgVerify = await read("packages/desktop/scripts/verify-macos-dmg.ts")
const appZipVerify = await read("packages/desktop/scripts/verify-macos-appzip.ts")
const macStage = await read("packages/desktop/scripts/stage-macos-bundles.ts")
const railwiseBuild = await read("packages/railwise/script/build.ts")
const railwiseModels = await read("packages/railwise/script/models.ts")
const cli = await read("packages/desktop/src-tauri/src/cli.rs")
const lib = await read("packages/desktop/src-tauri/src/lib.rs")
const main = await read("packages/desktop/src-tauri/src/main.rs")
const windowsRs = await read("packages/desktop/src-tauri/src/windows.rs")
const customizer = await read("packages/desktop/src-tauri/src/window_customizer.rs")
const cargo = await read("packages/desktop/src-tauri/Cargo.toml")
const bindings = await read("packages/desktop/src/bindings.ts")
const icons = await read("packages/desktop/src-tauri/icons/railwise/README.md")
const containers = await read("packages/containers/script/build.ts")
const containersReadme = await read("packages/containers/README.md")
const dialog = await read("packages/desktop/src/components/update-dialog.tsx")
const infoPlist = await read("packages/desktop/src-tauri/Info.plist")
const platform = await read("packages/app/src/context/platform.tsx")
const settings = await read("packages/app/src/components/settings-general.tsx")
const desktop = await read("packages/desktop/src/index.tsx")
const e2eHarness = await read("packages/desktop/e2e/helpers/app.ts")
const downloadTypes = await read("packages/console/app/src/routes/download/types.ts")
const downloadRoute = await read("packages/console/app/src/routes/download/[platform].ts")
const downloadPage = await read("packages/console/app/src/routes/download/index.tsx")
const i18n = await Promise.all(
  (await Array.fromAsync(new Bun.Glob("packages/console/app/src/i18n/*.ts").scan({ cwd: root }))).map((item) => read(item)),
)
const adminDeploy = await read("docs/admin/01-deploy.md")
const readme = await read("README.md")
const targets = ["aarch64-apple-darwin", "x86_64-apple-darwin"]
const secrets = [
  "TAURI_SIGNING_PRIVATE_KEY",
  "TAURI_SIGNING_PRIVATE_KEY_PASSWORD",
  "APPLE_CERTIFICATE",
  "APPLE_CERTIFICATE_PASSWORD",
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
const scope = "桌面端不发布 Linux 版本"
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
  config.bundle?.macOS?.infoPlist,
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
const nativeLinux = [
  'target_os = "linux"',
  "linux_display",
  "linux_windowing",
  "LinuxDisplayBackend",
  "get_display_backend",
  "set_display_backend",
  "webkit2gtk",
  "gtk =",
  "Wayland",
  "wayland",
]
const linuxDownloads = ["linux-x64", "linuxDeb", "linuxRpm", "download.platform.linux", "AppImage", "Linux"]

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
    config.bundle?.linux === undefined &&
    devConfig.bundle?.linux === undefined &&
    adminDeploy.includes(scope) &&
    readme.includes("Linux 仅保留 CLI，不做桌面安装包") &&
    !readme.includes("支持 Windows / macOS / Linux 离线安装") &&
    !sidecar.includes("linux-") &&
    !adminDeploy.includes("Linux 安装包") &&
    !adminDeploy.includes("linux/"),
  "Desktop release excludes Linux installers, Tauri Linux bundle config, and deployment docs explicitly mark Linux as CLI-only",
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
  "desktop runtime omits Linux surface",
  !platform.includes('"macos" | "windows" | "linux"') &&
    !settings.includes('platform.os === "linux"') &&
    !settings.includes("settings-wayland") &&
    !desktop.includes('type === "linux"') &&
    !e2eHarness.includes('os_type: "linux"') &&
    !e2eHarness.includes('platform: "linux"'),
  "Desktop UI/runtime exposes macOS and Windows only; Linux remains CLI-only",
)
check(
  "desktop download page omits Linux installers",
  [downloadTypes, downloadRoute, downloadPage, ...i18n.map((text) =>
    text.slice(text.indexOf(`"download.title"`), text.indexOf(`"download.faq.a3.beforeLocal"`)),
  )].every((text) => linuxDownloads.every((item) => !text.includes(item))),
  "Download UI, locale labels, and /download/:platform route expose macOS DMG and Windows NSIS only",
)
check(
  "desktop native shell omits Linux runtime",
  [main, lib, windowsRs, customizer, cargo, bindings, icons].every((text) =>
    nativeLinux.every((item) => !text.includes(item)),
  ) &&
    !(await exists("packages/desktop/src-tauri/src/linux_display.rs")) &&
    !(await exists("packages/desktop/src-tauri/src/linux_windowing.rs")),
  "Desktop native shell removes Linux/Wayland runtime modules, commands, bindings, and target dependencies",
)
check(
  "desktop build containers omit Linux desktop image",
  !containers.includes("tauri-linux") &&
    !containersReadme.includes("tauri-linux") &&
    containersReadme.includes("RAILWISE Desktop does not build or publish Linux installers") &&
    !(await exists("packages/containers/tauri-linux/Dockerfile")),
  "CI container image list no longer maintains a Tauri Linux desktop build image",
)
check(
  "sidecar infers host desktop target",
  contains(sidecar, [
    "function host()",
    'process.platform === "darwin"',
    'process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"',
    'process.platform === "win32"',
    '"x86_64-pc-windows-msvc"',
    "Bun.env.RUST_TARGET || host()",
  ]) && predev.includes('arg("--target") || Bun.env.TAURI_ENV_TARGET_TRIPLE || Bun.env.RUST_TARGET || undefined'),
  "Local Desktop predev can infer the current macOS or Windows sidecar target",
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
    "Set APPLE_CERTIFICATE, APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_ID_PASSWORD, and APPLE_TEAM_ID.",
  ]),
  "Public macOS beta releases fail fast instead of publishing unsigned DMGs",
)
check(
  "release keychain grants codesign",
  contains(workflow, [
    'KEYCHAIN_PASSWORD="$(uuidgen)"',
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
    "bun run prepare:tauri",
    "bun run tauri -- build",
    "--bundles ${{ matrix.bundles }}",
    "--config src-tauri/tauri.ci.conf.json",
  ]),
  "production Tauri config is converted to CI config and Bun forwards target/bundle release arguments",
)
check(
  "release verifies macOS app signature",
  contains(workflow, [
    "Verify macOS app bundle",
    "bun run verify:macos -- --target",
    "Verify macOS DMG contents",
    "bun run verify:dmg -- --target",
    "Stage bundle artifacts",
    "bun run stage:macos:bundles -- --target",
    "target/desktop-release/${{ matrix.target }}",
  ]),
  "CI verifies the app bundle and DMG contents before uploading release artifacts",
)
check(
  "desktop dev loopback host",
  devConfig.build?.devUrl === "http://127.0.0.1:1420" && vite.includes('host: host || "127.0.0.1"'),
  "development startup avoids localhost DNS resolution and binds Vite to loopback IP",
)
check(
  "sidecar build can skip dependency reinstall",
  contains(predev, ["RAILWISE_SKIP_INSTALL", "--skip-install", "bun run build --single --skip-install"]) &&
    pkg.scripts?.predev?.includes("--skip-install") === true &&
    pkg.scripts?.["build:macos:local"]?.startsWith("bun run predev &&") === true,
  "local desktop verification and dev startup can refresh the sidecar in restricted environments",
)
check(
  "sidecar build honors explicit desktop target",
  contains(predev, ["const cli = sidecarConfig.ocBinary", "--target ${cli}"]) &&
    contains(railwiseBuild, [
      'const only = arg("--target")',
      "return name(item) === only",
      "throw new Error(`Unknown target: ${only}`)",
    ]),
  "Desktop predev maps macOS/Windows targets to the matching CLI sidecar build target",
)
check(
  "local Tauri config preparation script",
  pkg.scripts?.["prepare:tauri"] === "bun ./scripts/prepare-tauri-config.ts" &&
    pkg.scripts?.["build:macos:local"]?.includes("bun run prepare:tauri") === true &&
    contains(prepare, [
      "src-tauri/tauri.prod.conf.json",
      "src-tauri/tauri.ci.conf.json",
      "TAURI_SIGNING_PRIVATE_KEY",
      "config.bundle.createUpdaterArtifacts = false",
    ]),
  "Local macOS app builds can reuse the CI config path and disable updater artifacts when signing keys are unavailable",
)
check(
  "local macOS DMG packaging script",
  pkg.scripts?.["package:dmg:local"] === "bun ./scripts/package-local-dmg.ts" &&
    pkg.scripts?.["build:dmg:local"]?.includes("bun run package:dmg:local") === true &&
    contains(localDmg, [
      "hdiutil create -ov -format UDZO",
      "--require-dmg",
      "--zip-output",
      "ditto -c -k --sequesterRsrc --keepParent",
      "bun ./scripts/verify-macos-appzip.ts --zip",
      "bun ./scripts/sign-macos-app.ts --app",
      "bun ./scripts/verify-macos-dmg.ts --dmg",
      "ln -s /Applications",
    ]),
  "Local macOS packaging prefers DMG and falls back to a signed app zip when hdiutil is sandboxed",
)
check(
  "local macOS ad-hoc signing script",
  pkg.scripts?.["sign:macos"] === "bun ./scripts/sign-macos-app.ts" &&
    contains(macSign, [
      'const appArg = arg("--app")',
      "if (!target && !appArg)",
      "APPLE_SIGNING_IDENTITY",
      "codesign --force --deep --sign -",
      "codesign --verify --deep --strict --verbose=4",
      "apple-darwin",
    ]),
  "Local macOS app bundles can be sealed with ad-hoc signing when Developer ID is unavailable",
)
check(
  "macOS bundle verification script",
  pkg.scripts?.["verify:macos"] === "bun ./scripts/verify-macos-bundle.ts" &&
    contains(macVerify, [
      'const appArg = arg("--app")',
      "if (!target && !appArg)",
      "CFBundleIdentifier",
      "CFBundleExecutable",
      "railwise-cli",
      "executable ${arch}",
      "codesign --verify --deep --strict --verbose=4",
      '"target", "release", "bundle", "macos"',
    ]),
  "Local and CI macOS bundle verification checks plist, architecture, sidecar, and codesign",
)
check(
  "macOS DMG verification script",
  pkg.scripts?.["verify:dmg"] === "bun ./scripts/verify-macos-dmg.ts" &&
    contains(dmgVerify, [
      'const dmgArg = arg("--dmg")',
      "if (!target && !dmgArg)",
      "hdiutil attach",
      "-mountpoint",
      "verify-macos-bundle.ts",
      "hdiutil detach",
      '"target", "release", "bundle", "dmg"',
    ]),
  "Local and CI macOS DMG verification mounts the installer and checks the packaged app",
)
check(
  "macOS app zip verification script",
  pkg.scripts?.["verify:appzip"] === "bun ./scripts/verify-macos-appzip.ts" &&
    contains(appZipVerify, [
      'const zipArg = arg("--zip")',
      "if (!target && !zipArg)",
      "ditto -x -k",
      "verify-macos-bundle.ts",
      ".app.zip",
      '"target", "release", "bundle", "dmg"',
    ]),
  "Sandbox fallback app zip is extracted and verified with the same app bundle checks",
)
check(
  "macOS bundle staging script",
  pkg.scripts?.["stage:macos:bundles"] === "bun ./scripts/stage-macos-bundles.ts" &&
    contains(macStage, [
      '"desktop-release", target',
      "path.join(\"src-tauri\", \"target\", target, \"release\", \"bundle\")",
      "path.join(\"src-tauri\", \"target\", \"release\", \"bundle\")",
      "endsWith(\".dmg\")",
    ]),
  "CI uploads a deterministic bundle directory regardless of native or target-specific Tauri output paths",
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
  "production runtime config",
  config.build?.beforeBuildCommand === "bun run build" &&
    config.build?.frontendDist === "../dist" &&
    config.app?.windows?.some((item) => item.label === "main" && item.create === false) === true &&
    config.app?.withGlobalTauri === true &&
    config.app?.macOSPrivateApi === false &&
    config.app?.security?.csp?.includes("http://127.0.0.1:*") === true &&
    config.bundle?.active === true &&
    config.bundle?.externalBin?.includes("sidecars/railwise-cli") === true &&
    config.plugins?.["deep-link"]?.desktop?.schemes?.includes("railwise") === true,
  "production Tauri config keeps build frontendDist, deferred main window, CSP, sidecar, and deep-link settings",
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
    config.bundle?.macOS?.infoPlist === "./Info.plist" &&
    config.bundle?.macOS?.dmg?.background === "assets/dmg-background.png" &&
    Boolean(config.bundle?.macOS?.dmg?.appPosition) &&
    Boolean(config.bundle?.macOS?.dmg?.applicationFolderPosition),
  "DMG artwork, entitlements, Info.plist, and icon positions are configured",
)
check(
  "macOS modern launch services plist",
  infoPlist.includes("<key>LSRequiresCarbon</key>") &&
    infoPlist.includes("<false/>") &&
    infoPlist.includes("<key>NSPrincipalClass</key>") &&
    infoPlist.includes("<string>NSApplication</string>"),
  "Info.plist explicitly prevents legacy Carbon launch metadata and declares NSApplication",
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
