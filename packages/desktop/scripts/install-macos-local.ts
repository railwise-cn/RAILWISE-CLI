#!/usr/bin/env bun

import { $ } from "bun"
import { mkdir, mkdtemp, readdir, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

type Config = {
  identifier?: string
  mainBinaryName?: string
  productName?: string
}

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const flag = (name: string) => args.includes(name)

const info = async (file: string) => {
  const item = await stat(file).catch(() => undefined)
  return item
}

const zip = async () => {
  const dir = path.join("src-tauri", "target", "release", "bundle", "dmg")
  const files = await readdir(dir).catch(() => [])
  const zips = (
    await Promise.all(
      files
        .filter((item) => item.endsWith(".app.zip"))
        .map(async (item) => {
          const file = path.join(dir, item)
          const data = await info(file)
          return data?.isFile() ? { file, mtime: data.mtimeMs } : undefined
        }),
    )
  )
    .filter((item): item is { file: string; mtime: number } => Boolean(item))
    .sort((a, b) => b.mtime - a.mtime)

  if (zips[0]) return zips[0].file
  throw new Error(`No local macOS app zip found in ${dir}; run bun run package:dmg:local first.`)
}

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const name = config.productName ?? "睿威智测 RAILWISE"
const identifier = config.identifier ?? "com.railwiseai.desktop"
const executable = config.mainBinaryName ?? "railwise"
const home = os.homedir()
const input = arg("--zip")
const source = path.resolve(input ?? (await zip()))
const destination = path.resolve(arg("--destination", "/Applications")!)
const dry = flag("--dry-run")
const archiveStale = !flag("--keep-stale")
const stage = await mkdtemp(path.join(os.tmpdir(), "railwise-local-install-"))
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "")
const archive = path.join(home, "Desktop", "railwise-macos-stale-apps", stamp)
const app = path.join(stage, `${name}.app`)
const target = path.join(destination, `${name}.app`)

const exists = async (file: string) => Boolean(await info(file))

const plist = async (file: string, key: string) =>
  (await $`plutil -extract ${key} raw -o - ${file}`.quiet()).stdout.toString().trim()

const stale = async (dir: string) => {
  const files = await readdir(dir).catch(() => [])
  return files.filter((item) => item.startsWith(name) && item.endsWith(".app")).map((item) => path.join(dir, item))
}

const move = async (from: string) => {
  const to = path.join(archive, path.basename(from))
  if (dry) {
    console.log(`[dry-run] archive ${from} -> ${to}`)
    return
  }
  await mkdir(archive, { recursive: true })
  await $`ditto ${from} ${to}`
  await rm(from, { recursive: true, force: true })
  console.log(`Archived stale app ${from} -> ${to}`)
}

try {
  if ((await info(source))?.isFile() !== true) throw new Error(`App zip not found: ${source}`)

  await $`ditto -x -k ${source} ${stage}`
  if ((await info(app))?.isDirectory() !== true) throw new Error(`Expected app bundle in zip: ${app}`)

  const file = path.join(app, "Contents", "Info.plist")
  if ((await plist(file, "CFBundleIdentifier")) !== identifier)
    throw new Error(`Unexpected bundle identifier in ${file}`)
  if ((await plist(file, "CFBundleExecutable")) !== executable)
    throw new Error(`Unexpected bundle executable in ${file}`)
  if (!(await exists(path.join(app, "Contents", "MacOS", executable))))
    throw new Error(`Main executable missing: ${executable}`)
  if (!(await exists(path.join(app, "Contents", "MacOS", "railwise-cli"))))
    throw new Error("Sidecar executable missing: railwise-cli")

  if (archiveStale) {
    for (const item of [...(await stale("/Applications")), ...(await stale(path.join(home, "Applications")))]) {
      await move(item)
    }
  }

  if (dry) {
    console.log(`[dry-run] install ${app} -> ${target}`)
  } else {
    await mkdir(destination, { recursive: true })
    await rm(target, { recursive: true, force: true })
    await $`ditto ${app} ${target}`
    await $`xattr -dr com.apple.quarantine ${target}`.quiet().nothrow()
    await $`bun ./scripts/verify-macos-bundle.ts --app ${target}`

    console.log(
      [
        `Installed ${target}`,
        `Open it from Finder or run: open ${JSON.stringify(target)}`,
        `For a full launch smoke from normal Terminal: bun run smoke:macos -- --app ${JSON.stringify(target)} --ready-timeout 90`,
      ].join("\n"),
    )
  }
} finally {
  await rm(stage, { recursive: true, force: true })
}
