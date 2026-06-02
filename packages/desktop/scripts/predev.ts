import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

const arg = (name: string) => {
  const index = Bun.argv.indexOf(name)
  if (index === -1) return undefined
  return Bun.argv[index + 1]
}

const target = arg("--target") || Bun.env.TAURI_ENV_TARGET_TRIPLE || Bun.env.RUST_TARGET || undefined
const skipInstall = Bun.argv.includes("--skip-install") || Bun.env.RAILWISE_SKIP_INSTALL === "1"

const sidecarConfig = getCurrentSidecar(target)
const cli = sidecarConfig.ocBinary

const binaryPath = windowsify(`../railwise/dist/${sidecarConfig.ocBinary}/bin/railwise`)

if (sidecarConfig.ocBinary.includes("-baseline")) {
  await (skipInstall
    ? $`cd ../railwise && bun run build --single --baseline --skip-install --target ${cli}`
    : $`cd ../railwise && bun run build --single --baseline --target ${cli}`)
} else {
  await (skipInstall
    ? $`cd ../railwise && bun run build --single --skip-install --target ${cli}`
    : $`cd ../railwise && bun run build --single --target ${cli}`)
}

await copyBinaryToSidecarFolder(binaryPath, target)
