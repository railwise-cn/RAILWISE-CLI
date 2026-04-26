import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

const arg = (name: string) => {
  const index = Bun.argv.indexOf(name)
  if (index === -1) return undefined
  return Bun.argv[index + 1]
}

const target = arg("--target") ?? Bun.env.TAURI_ENV_TARGET_TRIPLE ?? Bun.env.RUST_TARGET

const sidecarConfig = getCurrentSidecar(target)

const binaryPath = windowsify(`../railwise/dist/${sidecarConfig.ocBinary}/bin/railwise`)

await (sidecarConfig.ocBinary.includes("-baseline")
  ? $`cd ../railwise && bun run build --single --baseline`
  : $`cd ../railwise && bun run build --single`)

await copyBinaryToSidecarFolder(binaryPath, target)
