#!/usr/bin/env bun

import { $ } from "bun"
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

type Json = Record<string, unknown>

const root = process.cwd()
const rootPkg = await Bun.file("package.json").json()
const catalog = (rootPkg.workspaces as { catalog?: Record<string, string> }).catalog ?? {}
const args = Bun.argv.slice(2)
const publish = args.includes("--publish")
const dry = !publish
const pack = path.join(root, "tmp", "npm-shared")
const dirs = ["packages/util", "packages/ui", "packages/app"]

if (args.includes("--help")) {
  console.log(
    [
      "Usage: bun ./scripts/publish-shared-packages.ts [--publish]",
      "",
      "Default mode stages packages and uses npm publish --dry-run.",
      "--publish is required for a real npm publish.",
    ].join("\n"),
  )
  process.exit(0)
}

const { Script } = await import("@railwise/script")
process.env.RAILWISE_VERSION = Script.version

function dep(name: string, version: string) {
  if (version === "workspace:*") return Script.version
  if (version === "catalog:") {
    const value = catalog[name]
    if (!value) throw new Error(`Missing catalog version for ${name}`)
    return value
  }
  return version
}

function deps(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  return Object.fromEntries(
    Object.entries(value as Record<string, string>).map(([name, version]) => [name, dep(name, version)]),
  )
}

async function write(pkg: Json, dir: string) {
  const next = { ...pkg }
  delete next.private
  next.version = Script.version
  next.dependencies = deps(next.dependencies)
  next.devDependencies = deps(next.devDependencies)
  next.peerDependencies = deps(next.peerDependencies)
  next.publishConfig = { access: "public" }
  next.files = dir.endsWith("/app") ? ["src", "public", "vite.js"] : ["src"]
  await writeFile(path.join(pack, dir, "package.json"), JSON.stringify(next, null, 2) + "\n")
}

async function stage(dir: string) {
  const dest = path.join(pack, dir)
  await mkdir(dest, { recursive: true })
  await cp(path.join(root, dir, "src"), path.join(dest, "src"), { recursive: true })
  if (dir.endsWith("/app") && (await Bun.file(path.join(root, dir, "public")).exists()))
    await cp(path.join(root, dir, "public"), path.join(dest, "public"), { recursive: true })
  if (dir.endsWith("/app")) await cp(path.join(root, dir, "vite.js"), path.join(dest, "vite.js"))
  await write((await Bun.file(path.join(root, dir, "package.json")).json()) as Json, dir)
}

await rm(pack, { recursive: true, force: true })
await Promise.all(dirs.map(stage))

await $`bun run --cwd packages/sdk/js build`
await (dry ? $`bun ./packages/sdk/js/script/publish.ts --dry-run` : $`bun ./packages/sdk/js/script/publish.ts`)

for (const dir of dirs) {
  await $`bun pm pack`.cwd(path.join(pack, dir))
  await (dry
    ? $`npm publish *.tgz --access public --tag ${Script.channel} --dry-run`.cwd(path.join(pack, dir))
    : $`npm publish *.tgz --access public --tag ${Script.channel}`.cwd(path.join(pack, dir)))
}

console.log("shared package publish complete")
