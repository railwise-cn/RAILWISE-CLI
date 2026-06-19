#!/usr/bin/env bun

import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { $ } from "bun"

const out = await mkdtemp(path.join(os.tmpdir(), "railwise-agent-pack-"))
const fail = (message: string) => {
  throw new Error(message)
}

try {
  await $`bun run assets:extract -- --out ${out} --name @railwise/agent-pack --version 0.0.0 --force`.quiet()

  const pkg = await Bun.file(path.join(out, "package.json")).json()
  const readme = await Bun.file(path.join(out, "README.md")).text()
  const assets = Array.isArray(pkg.agentAssets) ? pkg.agentAssets : []
  const names = (profile: string) =>
    assets
      .filter((asset) => (profile === "all" ? true : (asset.profile || "business") === profile))
      .map((asset) => `${asset.kind}/${asset.name}`)

  if (pkg.publishConfig) fail("agent pack package.json must not contain publishConfig")
  if (readme.includes("npx @railwise/agent-pack")) fail("agent pack README must not suggest npx install")
  if (!assets.length) fail("agent pack contains no assets")

  for (const item of ["agent/triage", "agent/duplicate-pr", "command/commit", "skill/bun-file-io"]) {
    if (names("business").includes(item)) fail(`business profile leaked dev asset: ${item}`)
  }

  for (const item of ["command/daily-report", "command/weekly-report", "command/plan-draft", "skill/report-dibao"]) {
    if (!names("business").includes(item)) fail(`business profile missing asset: ${item}`)
  }

  for (const item of ["agent/triage", "command/commit", "skill/bun-file-io", "tool/github-pr-search.ts"]) {
    if (!names("dev").includes(item)) fail(`dev profile missing asset: ${item}`)
  }

  const business = await $`node ${path.join(out, "bin/install.js")} list`.text()
  const dev = await $`node ${path.join(out, "bin/install.js")} list --profile dev`.text()
  const all = await $`node ${path.join(out, "bin/install.js")} list --profile all`.text()

  if (business.includes("command/commit")) fail("default list leaked command/commit")
  if (!business.includes("command/daily-report")) fail("default list is missing command/daily-report")
  if (!dev.includes("command/commit")) fail("dev list is missing command/commit")
  if (!all.includes("command/commit") || !all.includes("command/daily-report")) fail("all list is incomplete")

  console.log(`agent pack validated: ${names("business").length} business, ${names("dev").length} dev assets`)
} finally {
  await rm(out, { recursive: true, force: true })
}
