#!/usr/bin/env bun
import { $ } from "bun"
import pkg from "../package.json"
import { Script } from "@railwise/script"
import { fileURLToPath } from "url"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const binaries: Record<string, string> = {}
for (const filepath of new Bun.Glob("*/package.json").scanSync({ cwd: "./dist" })) {
  const pkg = await Bun.file(`./dist/${filepath}`).json()
  binaries[pkg.name] = pkg.version
}
console.log("binaries", binaries)
const version = Object.values(binaries)[0]

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
        postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
      },
      version: version,
      license: pkg.license,
      optionalDependencies: binaries,
    },
    null,
    2,
  ),
)

const tasks = Object.entries(binaries).map(async ([name]) => {
  if (process.platform !== "win32") {
    await $`chmod -R 755 .`.cwd(`./dist/${name}`)
  }
  await $`bun pm pack`.cwd(`./dist/${name}`)
  await $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(`./dist/${name}`)
})
await Promise.all(tasks)
await $`cd ./dist/${pkg.name} && bun pm pack && npm publish *.tgz --access public --tag ${Script.channel}`

console.log("npm publish complete")

if (!Script.preview) {
  const github = Script.github.full
  const ver = Script.version

  for (const name of Object.keys(binaries)) {
    if (name.includes("linux")) {
      await $`tar -czf ./dist/${name}.tar.gz -C ./dist/${name}/bin railwise`.nothrow()
    } else if (name.includes("darwin")) {
      await $`cd ./dist/${name}/bin && zip -q ../../${name}.zip railwise`.nothrow()
    } else if (name.includes("windows")) {
      await $`cd ./dist/${name}/bin && zip -q ../../${name}.zip railwise.exe`.nothrow()
    }
  }

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
