#!/usr/bin/env bun

import { Script } from "@railwise/script"
import { $ } from "bun"
import { mkdir, rename, rm } from "node:fs/promises"
import path from "node:path"

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)
const args = Bun.argv.slice(2)
const dry = args.includes("--dry-run")
const pack = args.includes("--pack-only")
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

const pkg = (await import("../package.json").then((m) => m.default)) as {
  name: string
  version: string
  exports: Record<string, string | object>
}
const original = JSON.parse(JSON.stringify(pkg))
pkg.version = Script.version
const tar = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${pkg.version}.tgz`
function output(file: string) {
  return file.replace("./src/", "./dist/src/").replace(".ts", "")
}
function transformExports(exports: Record<string, string | object>) {
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
      transformExports(item)
    } else if (typeof value === "string") {
      const file = output(value)
      exports[key] = {
        import: file + ".js",
        types: file + ".d.ts",
      }
    }
  }
}
transformExports(pkg.exports)
try {
  await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n")
  await $`bun pm pack`
  if (pack) {
    const out = arg("--out")
    if (out) {
      await mkdir(out, { recursive: true })
      await rename(tar, path.join(out, tar))
    }
  } else {
    await (dry
      ? $`npm publish ${tar} --tag ${Script.channel} --access public --dry-run`
      : $`npm publish ${tar} --tag ${Script.channel} --access public`)
  }
} finally {
  await Bun.write("package.json", JSON.stringify(original, null, 2) + "\n")
  if (!pack) await rm(tar, { force: true })
}
