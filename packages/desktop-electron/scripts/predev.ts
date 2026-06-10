import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

await $`bun ./scripts/copy-icons.ts ${process.env.RAILWISE_CHANNEL ?? "dev"}`

const RUST_TARGET = Bun.env.RUST_TARGET

const sidecarConfig = getCurrentSidecar(RUST_TARGET)

const binaryPath = windowsify(`../railwise/dist/${sidecarConfig.ocBinary}/bin/railwise`)

await (sidecarConfig.ocBinary.includes("-baseline")
  ? $`cd ../railwise && bun run build --single --baseline`
  : $`cd ../railwise && bun run build --single`)

await copyBinaryToSidecarFolder(binaryPath, RUST_TARGET)
