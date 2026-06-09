#!/usr/bin/env bun

import { $ } from "bun"
import { cp, mkdir, readdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

type Json = Record<string, unknown>

const args = Bun.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const flag = (name: string) => args.includes(name)
const root = process.cwd()
const out = path.resolve(root, arg("--out") ?? "../railwise-desktop-app")
const cli = arg("--cli-version") ?? (await Bun.file("packages/desktop/.cli-version").text()).trim()
const source = arg("--shared-source") ?? "npm"
const shared = path.resolve(root, arg("--shared-dir") ?? "dist/shared-packages")
const manifest =
  source === "file" && (await Bun.file(path.join(shared, "manifest.json")).exists())
    ? ((await Bun.file(path.join(shared, "manifest.json")).json()) as { version?: string }).version
    : undefined
const version = arg("--shared-version") ?? manifest ?? cli.replace(/^v/, "")
const force = flag("--force")
const history = flag("--history")
const branch = (await $`git branch --show-current`.text()).trim()
const catalog = ((await Bun.file("package.json").json()).workspaces as { catalog?: Record<string, string> }).catalog ?? {}
const ignored = new Set([
  "node_modules",
  "dist",
  "target",
  ".turbo",
  "e2e/playwright-report",
  "e2e/test-results",
  "src-tauri/sidecars",
  "src-tauri/target",
])

async function exists(file: string) {
  return await stat(file).then(
    () => true,
    () => false,
  )
}

function dep(name: string, value: string) {
  if (value === "workspace:*") {
    if (source === "file") return `file:vendor/shared/${file(name)}`
    return `^${version}`
  }
  if (value === "catalog:") {
    const found = catalog[name]
    if (!found) throw new Error(`Missing catalog version for ${name}`)
    return found
  }
  return value
}

function file(name: string) {
  return `${name.replace(/^@/, "").replace("/", "-")}-${version}.tgz`
}

function deps(value: unknown) {
  if (!value || typeof value !== "object") return undefined
  return Object.fromEntries(Object.entries(value as Record<string, string>).map(([name, value]) => [name, dep(name, value)]))
}

async function rewritePackage() {
  const pkgfile = path.join(out, "package.json")
  const pkg = (await Bun.file(pkgfile).json()) as Json
  const dependencies = deps(pkg.dependencies) ?? {}
  if (source === "file") (dependencies as Record<string, string>)["@railwise/sdk"] = `file:vendor/shared/${file("@railwise/sdk")}`
  pkg.dependencies = dependencies
  if (source === "file") {
    pkg.overrides = {
      ...((pkg.overrides ?? {}) as Record<string, string>),
      "@railwise/app": `file:vendor/shared/${file("@railwise/app")}`,
      "@railwise/sdk": `file:vendor/shared/${file("@railwise/sdk")}`,
      "@railwise/ui": `file:vendor/shared/${file("@railwise/ui")}`,
      "@railwise/util": `file:vendor/shared/${file("@railwise/util")}`,
    }
  }
  pkg.devDependencies = deps(pkg.devDependencies)
  const scripts = (pkg.scripts ?? {}) as Record<string, string>
  scripts.predev = "bun ./scripts/prepare.ts"
  if (scripts["build:macos:local"])
    scripts["build:macos:local"] = scripts["build:macos:local"].replace("bun run predev", "bun ./scripts/prepare.ts")
  pkg.scripts = scripts
  await writeFile(pkgfile, JSON.stringify(pkg, null, 2) + "\n")
}

async function vendor() {
  if (source !== "file") return
  const dir = path.join(out, "vendor/shared")
  await mkdir(dir, { recursive: true })
  for (const name of ["@railwise/sdk", "@railwise/util", "@railwise/ui", "@railwise/app"])
    await cp(path.join(shared, file(name)), path.join(dir, file(name)))
}

async function workflow() {
  const source = await Bun.file(".github/workflows/desktop-release.yml").text()
  const text = source
    .replaceAll("uses: ./.github/actions/setup-bun", "uses: oven-sh/setup-bun@v2")
    .replaceAll("working-directory: packages/desktop", "working-directory: .")
    .replaceAll("packages/desktop/", "")
    .replace("bun install --frozen-lockfile", "bun install")
    .replace("bun run predev -- --target ${{ matrix.target }}", "bun ./scripts/prepare.ts --target ${{ matrix.target }}")
  await mkdir(path.join(out, ".github/workflows"), { recursive: true })
  await writeFile(path.join(out, ".github/workflows/desktop-release.yml"), text)
}

async function tsconfig() {
  const file = path.join(out, "tsconfig.json")
  const json = (await Bun.file(file).json()) as {
    compilerOptions?: { paths?: Record<string, string[]> }
    references?: unknown
  }
  delete json.references
  json.compilerOptions = {
    ...(json.compilerOptions ?? {}),
    paths: {
      ...(json.compilerOptions?.paths ?? {}),
      "@/*": ["./node_modules/@railwise/app/src/*"],
    },
  }
  await writeFile(file, JSON.stringify(json, null, 2) + "\n")
}

async function snapshot(source: string, dest: string) {
  await mkdir(dest, { recursive: true })
  for (const entry of await readdir(source, { withFileTypes: true })) {
    const src = path.join(source, entry.name)
    const dst = path.join(dest, entry.name)
    const rel = path.relative(path.join(root, "packages/desktop"), src)
    if (ignored.has(entry.name) || ignored.has(rel)) continue
    if (entry.isDirectory()) {
      await snapshot(src, dst)
      continue
    }
    if (entry.isFile()) await cp(src, dst)
  }
}

if (await exists(out)) {
  if (!force) throw new Error(`${out} already exists. Pass --force to replace it.`)
  await rm(out, { recursive: true, force: true })
}

if (history) {
  await $`git clone --no-local --single-branch --branch ${branch} ${root} ${out}`
  await $`git filter-repo --refs HEAD --path packages/desktop/ --path-rename packages/desktop/: --force`.cwd(out)
} else {
  await snapshot(path.join(root, "packages/desktop"), out)
  await $`git init`.cwd(out)
}
await rewritePackage()
await tsconfig()
await vendor()
await workflow()
await cp("packages/desktop/.cli-version", path.join(out, ".cli-version"))

await $`git add -A`.cwd(out)
if ((await $`git status --porcelain`.cwd(out).text()).trim())
  await $`git commit -m ${"chore: standalone repo rewrites (npm deps, workflow, tsconfig, .cli-version)"}`.cwd(out)

console.log(`Exported desktop repo to ${out}`)
console.log(`History mode: ${history ? "filter-repo" : "snapshot"}`)
console.log(`CLI sidecar version: ${cli}`)
console.log(`Shared package source: ${source === "file" ? shared : `^${version}`}`)
