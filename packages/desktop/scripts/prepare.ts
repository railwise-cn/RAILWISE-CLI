#!/usr/bin/env bun
import { $ } from "bun"

import { copyBinaryToSidecarFolder, getCurrentSidecar, windowsify } from "./utils"

const pkg = await Bun.file("./package.json").json()
const tagged = Bun.env.GITHUB_REF_NAME?.startsWith("desktop/v")
  ? Bun.env.GITHUB_REF_NAME.replace(/^desktop\/v/, "")
  : undefined
const desktop = Bun.env.RAILWISE_DESKTOP_VERSION || tagged || pkg.version
pkg.version = desktop
await Bun.write("./package.json", JSON.stringify(pkg, null, 2) + "\n")
console.log(`Updated package.json version to ${pkg.version}`)

const sidecarConfig = getCurrentSidecar()

const dir = "src-tauri/target/railwise-binaries"
const version = (
  Bun.env.RAILWISE_CLI_VERSION ??
  (await Bun.file(".cli-version").exists() ? await Bun.file(".cli-version").text() : "")
).trim()
const tag = Bun.env.RAILWISE_CLI_TAG ?? (version.startsWith("v") ? version : `v${version}`)
const repo = Bun.env.RAILWISE_CLI_REPO ?? "railwise-cn/RAILWISE-CLI"
const source = Bun.env.RAILWISE_CLI_SOURCE ?? "release"

await $`rm -rf ${dir}`
await $`mkdir -p ${dir}`
if (source === "run") {
  if (!Bun.env.GITHUB_RUN_ID) throw new Error("GITHUB_RUN_ID is required when RAILWISE_CLI_SOURCE=run")
  await $`gh run download ${Bun.env.GITHUB_RUN_ID} -n railwise-cli`.cwd(dir)
  await copyBinaryToSidecarFolder(windowsify(`${dir}/${sidecarConfig.ocBinary}/bin/railwise`))
  process.exit(0)
}

if (!version) throw new Error("Missing .cli-version or RAILWISE_CLI_VERSION")

await $`gh release download ${tag} -R ${repo} -p ${`${sidecarConfig.ocBinary}.${sidecarConfig.assetExt}`} -D ${dir} --clobber`
await $`mkdir -p ${dir}/unpacked`
await $`unzip -oq ${`${dir}/${sidecarConfig.ocBinary}.${sidecarConfig.assetExt}`} -d ${dir}/unpacked`

await copyBinaryToSidecarFolder(windowsify(`${dir}/unpacked/railwise`))
