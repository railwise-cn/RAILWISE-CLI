#!/usr/bin/env bun

import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { $ } from "bun"

const tmp = await mkdtemp(path.join(os.tmpdir(), "railwise-npm-agent-pack-"))
const root = process.cwd()
const fail = (message: string) => {
  throw new Error(message)
}

try {
  await mkdir(path.join(tmp, "package"), { recursive: true })
  await $`bun ./scripts/extract-assets.ts --out ${path.join(tmp, "package", "agent-pack")} --name @railwise/agent-pack --version 0.0.0 --force`.quiet()
  await cp("packages/railwise/script/postinstall.mjs", path.join(tmp, "package", "postinstall.mjs"))
  await writeFile(
    path.join(tmp, "package", "package.json"),
    JSON.stringify({ name: "railwise-ai", version: "0.0.0", files: ["agent-pack", "postinstall.mjs"] }),
  )

  await $`bun pm pack`.cwd(path.join(tmp, "package")).quiet()
  const packed = await $`tar -tzf railwise-ai-0.0.0.tgz`.cwd(path.join(tmp, "package")).text()
  if (!packed.includes("package/agent-pack/bin/install.js")) fail("npm tarball does not contain Agent Pack installer")
  if (!packed.includes("package/agent-pack/assets/command/daily-report.md"))
    fail("npm tarball does not contain business assets")

  const dest = path.join(tmp, "installed")
  await $`node postinstall.mjs`
    .cwd(path.join(tmp, "package"))
    .env({
      ...process.env,
      RAILWISE_SKIP_BINARY_SETUP: "1",
      RAILWISE_AGENT_PACK_DEST: dest,
    })
    .quiet()

  const exists = async (file: string) => await Bun.file(path.join(dest, file)).exists()
  if (!(await exists("command/daily-report.md"))) fail("npm postinstall did not install business command")
  if (!(await exists("command/weekly-report.md"))) fail("npm postinstall did not install new weekly command")
  if (!(await exists("skill/report-dibao/SKILL.md"))) fail("npm postinstall did not install report-dibao skill")
  if (!(await exists("templates/daily-monitor-report.json"))) fail("npm postinstall did not install business template")
  if (await exists("command/commit.md")) fail("npm postinstall leaked dev command")
  if (await exists("skill/bun-file-io/SKILL.md")) fail("npm postinstall leaked dev skill")

  console.log("npm agent pack postinstall validated")
} finally {
  if (root) process.chdir(root)
  await rm(tmp, { recursive: true, force: true })
}
