#!/usr/bin/env bun

import { $ } from "bun"
import { mkdir, readdir, readFile, rename, stat, writeFile } from "node:fs/promises"
import path from "node:path"

type Config = {
  lastSyncedTag: string
  upstream: {
    remote: string
    url: string
    packagePath: string
    rebrandedPackagePath: string
  }
  protectedPaths: string[]
  textReplacements: Array<{ from: string; to: string }>
  pathReplacements: Array<{ from: string; to: string }>
  binaryExtensions: string[]
}

const root = process.cwd()
const config = (await Bun.file("scripts/rebrand.config.json").json()) as Config
const args = Bun.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const flag = (name: string) => args.includes(name)

const tag = arg("--to")
const branch = arg("--branch") ?? (tag ? `sync/${tag}` : undefined)
const dry = flag("--dry-run")
const force = flag("--force")
const dirty = flag("--allow-dirty")

if (!tag) throw new Error("Missing --to <upstream-tag>")
if (!branch) throw new Error("Missing sync branch name")

const protectedRoots = new Set(config.protectedPaths.map((item) => path.normalize(item)))
const binaries = new Set(config.binaryExtensions)

function rel(file: string) {
  return path.relative(root, file)
}

function protectedPath(file: string) {
  const value = rel(file)
  return [...protectedRoots].some((item) => value === item || value.startsWith(`${item}${path.sep}`))
}

async function exists(file: string) {
  return await Bun.file(file).exists()
}

async function walk(dir: string): Promise<string[]> {
  if (protectedPath(dir) && dir !== root) return []
  const entries = await readdir(dir, { withFileTypes: true })
  return (
    await Promise.all(
      entries.flatMap(async (entry) => {
        const file = path.join(dir, entry.name)
        if (protectedPath(file)) return []
        if (entry.isDirectory()) return [file, ...(await walk(file))]
        if (entry.isFile()) return [file]
        return []
      }),
    )
  ).flat()
}

async function text(file: string) {
  if (binaries.has(path.extname(file).toLowerCase())) return false
  const content = await readFile(file)
  if (content.includes(0)) return false
  return true
}

function replace(content: string) {
  return config.textReplacements.reduce((next, item) => next.split(item.from).join(item.to), content)
}

function renamed(name: string) {
  return config.pathReplacements.reduce((next, item) => next.split(item.from).join(item.to), name)
}

async function rebrand() {
  if ((await exists(config.upstream.packagePath)) && !(await exists(config.upstream.rebrandedPackagePath))) {
    await mkdir(path.dirname(config.upstream.rebrandedPackagePath), { recursive: true })
    await rename(config.upstream.packagePath, config.upstream.rebrandedPackagePath)
  }

  const files = await walk(root)
  const writable = files.filter((file) => !protectedPath(file))
  await Promise.all(
    writable.map(async (file) => {
      if ((await stat(file)).isDirectory()) return
      if (!(await text(file))) return
      const old = await readFile(file, "utf8")
      const next = replace(old)
      if (next !== old) await writeFile(file, next)
    }),
  )

  const paths = (await walk(root)).filter((file) => !protectedPath(file)).sort((a, b) => b.length - a.length)

  for (const file of paths) {
    const name = path.basename(file)
    const next = renamed(name)
    if (next === name) continue
    const target = path.join(path.dirname(file), next)
    if (await exists(target)) continue
    await rename(file, target)
  }
}

async function ensure() {
  const remote = await $`git remote get-url ${config.upstream.remote}`.quiet().nothrow()
  if (remote.exitCode === 0) return
  await $`git remote add ${config.upstream.remote} ${config.upstream.url}`
}

if (dry) {
  console.log(
    [
      `Would fetch tag ${tag} from ${config.upstream.remote} into refs/railwise-sync/${tag} (collision-safe)`,
      `Would create ${branch} from ${tag}`,
      `Would rename ${config.upstream.packagePath} -> ${config.upstream.rebrandedPackagePath}`,
      `Would apply ${config.textReplacements.length} text replacements and ${config.pathReplacements.length} path replacements`,
      `Last recorded sync base: ${config.lastSyncedTag}`,
    ].join("\n"),
  )
  process.exit(0)
}

if (!dirty && (await $`git status --porcelain`.text()).trim()) {
  throw new Error("Working tree is dirty. Commit/stash changes or pass --allow-dirty.")
}

await ensure()

// The fork mirrors upstream version numbers, so local release tags (v1.2.8, ...)
// collide with upstream's identically named tags. Fetch the requested ref into a
// private namespace to avoid clobbering local tags and to guarantee we check out
// upstream's commit rather than the fork's same-named tag.
const upstreamRef = `refs/railwise-sync/${tag}`
const fetchedTag = await $`git fetch --no-tags ${config.upstream.remote} +refs/tags/${tag}:${upstreamRef}`
  .quiet()
  .nothrow()
if (fetchedTag.exitCode !== 0) {
  const fetchedHead = await $`git fetch --no-tags ${config.upstream.remote} +refs/heads/${tag}:${upstreamRef}`
    .quiet()
    .nothrow()
  if (fetchedHead.exitCode !== 0)
    throw new Error(`Could not fetch ${tag} from ${config.upstream.remote} as a tag or branch:\n${fetchedTag.stderr}`)
}

const current = (await $`git branch --show-current`.text()).trim()
const branchExists = (await $`git rev-parse --verify ${branch}`.quiet().nothrow()).exitCode === 0
if (branchExists && !force) throw new Error(`${branch} already exists. Pass --force to replace it.`)
if (branchExists) await $`git branch -D ${branch}`

await $`git switch --detach ${upstreamRef}`
await $`git switch -c ${branch}`
await rebrand()
await $`git add -A`

const changed = (await $`git status --porcelain`.text()).trim()
if (changed) await $`git commit -m ${`chore(sync): rebrand upstream ${tag}`}`
if (current) await $`git switch ${current}`

console.log(`${branch} is ready. Rebase with: git rebase --onto ${branch} sync/${config.lastSyncedTag} dev`)
