#!/usr/bin/env bun

import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises"
import path from "node:path"

type Asset = {
  kind: string
  name: string
  dir: string
  target?: string
}

const args = Bun.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const flag = (name: string) => args.includes(name)

const out = arg("--out") ?? "railwise-agent-pack"
const name = arg("--name") ?? "@railwise/agent-pack"
const version = arg("--version") ?? "0.1.0"
const force = flag("--force")
const tests = flag("--include-tests")
const assets: Asset[] = []
const repository = {
  type: "git",
  url: "git+https://github.com/railwise-cn/RAILWISE-CLI.git",
}

async function exists(file: string) {
  return await stat(file).then(
    () => true,
    () => false,
  )
}

async function files(dir: string) {
  const found = [...new Bun.Glob("**/*").scanSync({ cwd: dir })].sort()
  return (
    await Promise.all(
      found.map(async (file) => ({
        file,
        stat: await stat(path.join(dir, file)),
      })),
    )
  )
    .filter((item) => item.stat.isFile())
    .map((item) => item.file)
}

async function copy(source: string, target: string) {
  await mkdir(path.dirname(target), { recursive: true })
  await cp(source, target, { recursive: true })
}

function base(file: string) {
  return path.basename(file, path.extname(file))
}

async function fileAssets(kind: string, source: string, ext?: string) {
  if (!(await exists(source))) return
  for (const file of await files(source)) {
    if (!tests && file.includes(".test.")) continue
    if (ext && path.extname(file) !== ext) continue
    const dir = `assets/${kind}/${file.replaceAll("\\", "/")}`
    await copy(path.join(source, file), path.join(out, dir))
    assets.push({ kind, name: ext ? base(file) : file, dir, target: file.replaceAll("\\", "/") })
  }
}

async function dirAssets(kind: string, source: string) {
  if (!(await exists(source))) return
  for (const file of [...new Bun.Glob("*/SKILL.md").scanSync({ cwd: source })].sort()) {
    const asset = file.split("/")[0]
    const dir = `assets/${kind}/${asset}`
    await copy(path.join(source, asset), path.join(out, dir))
    assets.push({ kind, name: asset, dir })
  }
}

if (force) await rm(out, { recursive: true, force: true })
if (await exists(out)) throw new Error(`${out} already exists. Pass --force to replace it.`)

await mkdir(path.join(out, "assets"), { recursive: true })
await copy("skill-pack-template/bin/install.js", path.join(out, "bin/install.js"))
await fileAssets("agent", ".railwise/agent", ".md")
await dirAssets("skill", ".railwise/skill")
await fileAssets("command", ".railwise/command", ".md")
await fileAssets("tool", ".railwise/tool")
await fileAssets("lib", ".railwise/lib")
await fileAssets("template", ".railwise/templates", ".json")
await fileAssets("theme", ".railwise/themes", ".json")

await writeFile(
  path.join(out, "package.json"),
  JSON.stringify(
    {
      name,
      version,
      type: "commonjs",
      license: "MIT",
      repository,
      bin: {
        "railwise-skill": "./bin/install.js",
        "railwise-agent-pack": "./bin/install.js",
      },
      files: ["assets", "bin"],
      agentAssets: assets.sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name)),
      publishConfig: {
        access: "public",
      },
    },
    null,
    2,
  ) + "\n",
)

await writeFile(
  path.join(out, "README.md"),
  [
    "# Railwise Agent Pack",
    "",
    "Install Railwise agents, skills, commands, tools, templates, and themes into supported coding agents.",
    "",
    "```bash",
    "npx @railwise/agent-pack install --target railwise --force",
    "npx @railwise/agent-pack install --target codex",
    "npx @railwise/agent-pack list",
    "```",
    "",
  ].join("\n"),
)

console.log(`Extracted ${assets.length} assets to ${out}`)
