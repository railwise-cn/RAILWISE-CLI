#!/usr/bin/env bun
import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

const args = Bun.argv.slice(2)
const host = {
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
  "win32-x64": "x86_64-pc-windows-msvc",
  "linux-x64": "x86_64-unknown-linux-gnu",
  "linux-arm64": "aarch64-unknown-linux-gnu",
}[`${process.platform}-${process.arch}`]
const target = args[args.indexOf("--target") + 1 || args.length] ?? Bun.env.RUST_TARGET ?? host
if (!target) throw new Error("Pass --target <rust-triple> or set RUST_TARGET")

const pkg = await Bun.file("./package.json").json()
const tagged = Bun.env.GITHUB_REF_NAME?.startsWith("desktop/v")
  ? Bun.env.GITHUB_REF_NAME.replace(/^desktop\/v/, "")
  : undefined
pkg.version = Bun.env.RAILWISE_DESKTOP_VERSION || tagged || pkg.version
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${pkg.version}`)

const sidecarConfig = getCurrentSidecar(target)
const dir = "src-tauri/target/railwise-binaries"
const version = (
  Bun.env.RAILWISE_CLI_VERSION ?? ((await Bun.file(".cli-version").exists()) ? await Bun.file(".cli-version").text() : "")
).trim()
const tag = Bun.env.RAILWISE_CLI_TAG ?? (version.startsWith("v") ? version : `v${version}`)
const repo = Bun.env.RAILWISE_CLI_REPO ?? "railwise-cn/RAILWISE-CLI"
const source = Bun.env.RAILWISE_CLI_SOURCE ?? (Bun.env.GITHUB_RUN_ID ? "run" : "release")

await $`rm -rf ${dir}`
await $`mkdir -p ${dir}`

if (source === "run") {
  if (!Bun.env.GITHUB_RUN_ID) throw new Error("GITHUB_RUN_ID is required when RAILWISE_CLI_SOURCE=run")
  await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n railwise-cli`.cwd(dir)
  await copyBinaryToSidecarFolder(windowsify(`${dir}/${sidecarConfig.ocBinary}/bin/railwise`), target)
  process.exit(0)
}

if (!version) throw new Error("Missing .cli-version or RAILWISE_CLI_VERSION for release sidecar download")

const asset = `${sidecarConfig.ocBinary}.${sidecarConfig.assetExt}`
await $`gh release download ${tag} -R ${repo} -p ${asset} -D ${dir} --clobber`
await $`mkdir -p ${dir}/unpacked`
await (sidecarConfig.assetExt === "tar.gz"
  ? $`tar -xzf ${`${dir}/${asset}`} -C ${dir}/unpacked`
  : $`unzip -oq ${`${dir}/${asset}`} -d ${dir}/unpacked`)

await copyBinaryToSidecarFolder(windowsify(`${dir}/unpacked/railwise`), target)
