import { $ } from "bun"

import { SIDECAR_BINARIES, windowsify } from "./utils"

const arg = (name: string) => {
  const index = Bun.argv.indexOf(name)
  if (index === -1) return undefined
  return Bun.argv[index + 1]
}

const host = () => {
  if (process.platform === "darwin") return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (process.platform === "linux") return process.arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  if (process.platform === "win32") return "x86_64-pc-windows-msvc"
  throw new Error(`Unsupported cargo check platform '${process.platform}'`)
}

const explicit = arg("--target") ?? Bun.env.TAURI_ENV_TARGET_TRIPLE ?? Bun.env.RUST_TARGET
const target = explicit ?? host()
if (!SIDECAR_BINARIES.some((item) => item.rustTarget === target)) {
  throw new Error(`Sidecar configuration not available for Rust target '${target}'`)
}

const bin = windowsify(`src-tauri/sidecars/railwise-cli-${target}`)
const body =
  process.platform === "win32"
    ? "@echo off\r\necho RAILWISE cargo-check sidecar stub 1>&2\r\nexit /b 64\r\n"
    : "#!/bin/sh\nprintf '%s\\n' 'RAILWISE cargo-check sidecar stub' >&2\nexit 64\n"

await $`mkdir -p src-tauri/sidecars`
await Bun.write(bin, body)
if (process.platform !== "win32") await $`chmod 755 ${bin}`

console.log(`Prepared cargo check sidecar stub at ${bin}`)

await (explicit ? $`cd src-tauri && cargo check --target ${target}` : $`cd src-tauri && cargo check`)
