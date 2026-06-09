#!/usr/bin/env bun

import { Script } from "@railwise/script"
import { $ } from "bun"
import { cp } from "node:fs/promises"
import path from "node:path"

const args = Bun.argv.slice(2)
const flag = (name: string) => args.includes(name)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const dry = flag("--dry-run")
const packOnly = flag("--pack-only")
const out = arg("--out")

const dir = new URL("..", import.meta.url).pathname
process.chdir(dir)

const pkg = (await import("../package.json").then((m) => m.default)) as {
  name: string
  version: string
  exports: Record<string, string | object>
}
const original = JSON.parse(JSON.stringify(pkg))
const version = process.env.RAILWISE_VERSION || pkg.version
function transformExports(exports: Record<string, string | object>) {
  for (const [key, value] of Object.entries(exports)) {
    if (typeof value === "object" && value !== null) {
      transformExports(value as Record<string, string | object>)
    } else if (typeof value === "string") {
      const file = value.replace("./src/", "./dist/").replace(".ts", "")
      exports[key] = {
        import: file + ".js",
        types: file + ".d.ts",
      }
    }
  }
}
transformExports(pkg.exports)
pkg.version = version
await Bun.write("package.json", JSON.stringify(pkg, null, 2) + "\n")
await $`bun pm pack`
const tarball = `${pkg.name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`
if (out) await cp(tarball, path.join(out, tarball))
if (!packOnly)
  await (dry
    ? $`npm publish ${tarball} --tag ${Script.channel} --access public --dry-run`
    : $`npm publish ${tarball} --tag ${Script.channel} --access public`)
await Bun.write("package.json", JSON.stringify(original, null, 2) + "\n")
