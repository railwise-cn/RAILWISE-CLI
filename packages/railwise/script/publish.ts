#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@railwise/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)
const repository = {
  type: "git",
  url: "git+https://github.com/railwise-cn/RAILWISE-CLI.git",
}
const npm = new Set([
  "railwise-darwin-arm64",
  "railwise-darwin-x64",
  "railwise-linux-arm64",
  "railwise-linux-x64",
  "railwise-linux-x64-baseline",
  "railwise-linux-x64-baseline-musl",
  "railwise-windows-x64",
])

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json()
  binaries[pkg.name] = pkg.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]
const publish = Object.fromEntries(Object.entries(binaries).filter(([name]) => npm.has(name)))
const skipped = Object.keys(binaries).filter((name) => !npm.has(name))
if (skipped.length) console.warn(`Skipping npm publish for unbootstrapped binary packages: ${skipped.join(", ")}`)

async function archive(name: string) {
  if (name.includes("linux")) {
    await $`tar -czf ./dist/${name}.tar.gz -C ./dist/${name}/bin railwise`.nothrow()
    return
  }
  if (name.includes("darwin")) {
    await $`cd ./dist/${name}/bin && zip -q ../../${name}.zip railwise`.nothrow()
    return
  }
  if (name.includes("windows")) {
    await $`cd ./dist/${name}/bin && zip -q ../../${name}.zip railwise.exe`.nothrow()
  }
}

function message(value: unknown) {
  if (value instanceof Error) return value.message
  return String(value)
}

if (!Script.preview) {
  await Promise.all(Object.keys(binaries).map(archive))
}

await $`mkdir -p ./dist/${pkg.name}`
await $`cp -r ./bin ./dist/${pkg.name}/bin`
await $`cp ./script/postinstall.mjs ./dist/${pkg.name}/postinstall.mjs`
await Bun.file(`./dist/${pkg.name}/LICENSE`).write(await Bun.file("../../LICENSE").text())

await Bun.file(`./dist/${pkg.name}/package.json`).write(
  JSON.stringify(
    {
      name: pkg.name + "-ai",
      bin: {
        [pkg.name]: `./bin/${pkg.name}`,
      },
      scripts: {
        postinstall: "node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      repository,
      optionalDependencies: publish,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(publish).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)
  await $`env -u NODE_AUTH_TOKEN -u NPM_CONFIG_USERCONFIG npm publish *.tgz --access public --tag ${Script.channel} --provenance`.cwd(
    `./dist/${name}`,
  )
})
const results = await Promise.allSettled(tasks)
const failed = results.flatMap((result, index) =>
  result.status === "rejected" ? [`${Object.keys(publish)[index]}: ${message(result.reason)}`] : [],
)
if (failed.length) {
  console.warn(["Binary npm package publish failed (continuing with release assets):", ...failed].join("\n"))
}
await $`cd ./dist/${pkg.name} && bun pm pack && env -u NODE_AUTH_TOKEN -u NPM_CONFIG_USERCONFIG npm publish *.tgz --access public --tag ${Script.channel} --provenance`

console.log("npm publish complete")

if (!Script.preview) {
  const github = Script.github.full
  const ver = Script.version

  const sha = async (file: string) => {
    try {
      return (await $`sha256sum ./dist/${file} | cut -d' ' -f1`.text()).trim()
    } catch {
      return ""
    }
  }

  const macX64Sha = await sha("railwise-darwin-x64.zip")
  const macArm64Sha = await sha("railwise-darwin-arm64.zip")
  const x64Sha = await sha("railwise-linux-x64.tar.gz")
  const arm64Sha = await sha("railwise-linux-arm64.tar.gz")

  const formula = `# typed: false
# frozen_string_literal: true

class Railwise < Formula
  desc "AI coding agent built for the terminal"
  homepage "https://github.com/${github}"
  version "${ver.split("-")[0]}"

  depends_on "ripgrep"

  on_macos do
    if Hardware::CPU.intel?
      url "https://github.com/${github}/releases/download/v${ver}/railwise-darwin-x64.zip"
      sha256 "${macX64Sha}"
      def install
        bin.install "railwise"
      end
    end
    if Hardware::CPU.arm?
      url "https://github.com/${github}/releases/download/v${ver}/railwise-darwin-arm64.zip"
      sha256 "${macArm64Sha}"
      def install
        bin.install "railwise"
      end
    end
  end

  on_linux do
    if Hardware::CPU.intel? and Hardware::CPU.is_64_bit?
      url "https://github.com/${github}/releases/download/v${ver}/railwise-linux-x64.tar.gz"
      sha256 "${x64Sha}"
      def install
        bin.install "railwise"
      end
    end
    if Hardware::CPU.arm? and Hardware::CPU.is_64_bit?
      url "https://github.com/${github}/releases/download/v${ver}/railwise-linux-arm64.tar.gz"
      sha256 "${arm64Sha}"
      def install
        bin.install "railwise"
      end
    end
  end
end
`

  const token = process.env.HOMEBREW_TAP_TOKEN || process.env.GITHUB_TOKEN
  if (token) {
    try {
      const tap = `https://x-access-token:${token}@github.com/${Script.homebrew}.git`
      await $`rm -rf ./dist/homebrew-tap`
      await $`git clone ${tap} ./dist/homebrew-tap`
      await Bun.file("./dist/homebrew-tap/railwise.rb").write(formula)
      await $`cd ./dist/homebrew-tap && git config user.name "railwise-bot" && git config user.email "bot@railwise.ai" && git add railwise.rb && git commit -m "Update to v${ver}" && git push`
      console.log("Homebrew formula updated")
    } catch (e) {
      console.error("Homebrew update failed (non-blocking):", e instanceof Error ? e.message : e)
    }
  } else {
    console.log("No token set, skipping Homebrew update")
  }
}
