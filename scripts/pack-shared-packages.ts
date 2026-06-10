#!/usr/bin/env bun

import { $ } from "bun"
import { cp, mkdir, rm, writeFile } from "node:fs/promises"
import path from "node:path"

type Json = Record<string, unknown>
type Manifest = {
  version: string
  packages: Array<{ name: string; file: string }>
}

const root = process.cwd()
const args = Bun.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const out = path.resolve(root, arg("--out") ?? "dist/shared-packages")
const pack = path.join(root, "tmp", "npm-shared")
const dirs = ["packages/util", "packages/ui", "packages/app"]
const rootpkg = await Bun.file("package.json").json()
const catalog = (rootpkg.workspaces as { catalog?: Record<string, string> }).catalog ?? {}
const { Script } = await import("@railwise/script")
const version = Script.version
process.env.RAILWISE_VERSION = version

function file(name: string) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`
}

function dep(name: string, value: string) {
  if (value === "workspace:*") return version
  if (value === "catalog:") {
    const found = catalog[name]
    if (!found) throw new Error(`Missing catalog version for ${name}`)
    return found
  }
  return value
}

function deps(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  return Object.fromEntries(Object.entries(value as Record<string, string>).map(([name, value]) => [name, dep(name, value)]))
}

async function write(pkg: Json, dir: string) {
  const next = { ...pkg }
  delete next.private
  next.version = version
  next.dependencies = deps(next.dependencies)
  next.devDependencies = deps(next.devDependencies)
  next.peerDependencies = deps(next.peerDependencies)
  next.publishConfig = { access: "public" }
  next.files = dir.endsWith("/app") ? ["src", "public", "vite.js"] : ["src"]
  await writeFile(path.join(pack, dir, "package.json"), JSON.stringify(next, null, 2) + "\n")
  return next
}

async function stage(dir: string) {
  const dest = path.join(pack, dir)
  await mkdir(dest, { recursive: true })
  await cp(path.join(root, dir, "src"), path.join(dest, "src"), { recursive: true })
  if (dir.endsWith("/app") && (await Bun.file(path.join(root, dir, "public")).exists()))
    await cp(path.join(root, dir, "public"), path.join(dest, "public"), { recursive: true })
  if (dir.endsWith("/app")) await cp(path.join(root, dir, "vite.js"), path.join(dest, "vite.js"))
  const pkg = (await write((await Bun.file(path.join(root, dir, "package.json")).json()) as Json, dir)) as { name: string }
  await $`bun pm pack`.cwd(dest)
  await cp(path.join(dest, file(pkg.name)), path.join(out, file(pkg.name)))
  return { name: pkg.name, file: file(pkg.name) }
}

await rm(out, { recursive: true, force: true })
await rm(pack, { recursive: true, force: true })
await mkdir(out, { recursive: true })

await $`bun run --cwd packages/sdk/js build`
await $`bun ./packages/sdk/js/script/publish.ts --pack-only --out ${out}`

const manifest: Manifest = {
  version,
  packages: [{ name: "@railwise/sdk", file: file("@railwise/sdk") }, ...(await Promise.all(dirs.map(stage)))],
}
await writeFile(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n")

console.log(`Packed ${manifest.packages.length} shared packages to ${out}`)
