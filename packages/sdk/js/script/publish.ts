#!/usr/bin/env bun

import { Script } from "@railwise/script"
import { $ } from "bun"
import { copyFile, mkdir, rm } from "node:fs/promises"
import path from "node:path"

const args = Bun.argv.slice(2)
const flag = (name: string) => args.includes(name)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const dry = flag("--dry-run")
const pack = flag("--pack-only")
const out = arg("--out")

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

const pkg = (await import("../package.json").then((m) => m.default)) as {
  name: string
  version: string
  exports: Record<string, string | object>
}
const original = JSON.parse(JSON.stringify(pkg))
const version = (process.env.RAILWISE_VERSION || Script.version).replace(/[^0-9A-Za-z.-]/g, "-")
const channel = Script.channel.replace(/[^0-9A-Za-z.-]/g, "-")
const tar = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`

function output(file: string) {
  return file.replace("./src/", "./dist/src/").replace(".ts", "")
}

function transform(exports: Record<string, string | object>) {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "object" && value !== null) {
      const item = value as Record<string, string | object>
      const source = typeof item.default === "string" ? item.default : undefined
      const types = typeof item.types === "string" ? item.types : undefined
      if (source) {
        exports[key] = {
          import: output(source) + ".js",
          types: types ?? output(source) + ".d.ts",
        }
        continue
      }
      transform(item)
      continue
    }
    if (typeof value !== "string") continue
    const file = output(value)
    exports[key] = {
      import: file + ".js",
      types: file + ".d.ts",
    }
  }
}

transform(pkg.exports)
pkg.version = version

try {
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n")
  await $`bun pm pack`
  if (pack && out) {
    await mkdir(out, { recursive: true })
    await copyFile(tar, path.join(out, tar))
  }
  if (!pack) {
    await (dry
      ? $`npm publish ${tar} --tag ${channel} --access public --dry-run`
      : $`npm publish ${tar} --tag ${channel} --access public`)
  }
} finally {
  await Bun.write("package.json", JSON.stringify(original, null, 2) + "\n")
  if (!pack || out) await rm(tar, { force: true })
}
