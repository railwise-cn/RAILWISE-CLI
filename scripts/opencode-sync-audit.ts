#!/usr/bin/env bun

import { $ } from "bun"
import { readdir } from "node:fs/promises"

type Tree = {
  truncated?: boolean
  tree: Array<{
    path: string
    type: "blob" | "tree"
    sha: string
  }>
}

const args = process.argv.slice(2)
const arg = (name: string) => {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}
const base = args[0] ?? "v1.4.5"
const target = args[1] ?? "v1.15.3"
const baseTree = arg("--base-tree")
const targetTree = arg("--target-tree")
const baseLabel = arg("--base-label") ?? base
const targetLabel = arg("--target-label") ?? target
const prefixes = ["packages/opencode/", "packages/core/", "packages/app/", "packages/ui/", "packages/sdk/js/"]
const scoped = (file: string) =>
  file === "package.json" || file === "bun.lock" || prefixes.some((item) => file.startsWith(item))

const bump = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1
}

const table = (map: Record<string, number>) =>
  Object.entries(map)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => `| ${key} | ${count} |`)
    .join("\n")

const trees =
  baseTree && targetTree
    ? await Promise.all([baseTree, targetTree].map(async (file) => (await Bun.file(file).json()) as Tree))
    : undefined
if (trees?.some((tree) => tree.truncated))
  throw new Error("GitHub API returned a truncated tree; audit cannot continue")
const rows = trees
  ? (() => {
      const maps = trees.map(
        (tree) =>
          new Map(
            tree.tree.filter((item) => item.type === "blob" && scoped(item.path)).map((item) => [item.path, item.sha]),
          ),
      )
      return [...new Set([...maps[0].keys(), ...maps[1].keys()])].sort().flatMap((file) => {
        if (!maps[0].has(file)) return [{ status: "A", file }]
        if (!maps[1].has(file)) return [{ status: "D", file }]
        if (maps[0].get(file) !== maps[1].get(file)) return [{ status: "M", file }]
        return []
      })
    })()
  : (
      await $`git diff --name-status ${base}..${target} -- package.json bun.lock packages/opencode packages/core packages/app packages/ui packages/sdk/js`.text()
    )
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(/\s+/)
        return {
          status: parts[0],
          file: parts[parts.length - 1],
        }
      })

const scopes: Record<string, number> = {}
const statuses: Record<string, number> = {}
const backend: Record<string, number> = {}
const core: Record<string, number> = {}
const app: Record<string, number> = {}

for (const row of rows) {
  bump(statuses, row.status[0])
  bump(scopes, row.file.startsWith("packages/") ? row.file.split("/").slice(0, 2).join("/") : row.file)
  if (row.file.startsWith("packages/opencode/src/")) bump(backend, row.file.split("/")[3] ?? "(root)")
  if (row.file.startsWith("packages/core/src/")) bump(core, row.file.split("/")[3] ?? "(root)")
  if (row.file.startsWith("packages/app/src/")) bump(app, row.file.split("/")[3] ?? "(root)")
}

const mapped = await Promise.all(
  rows
    .filter((row) => row.file.startsWith("packages/opencode/") || row.file.startsWith("packages/core/"))
    .map(async (row) => {
      const file = row.file.replace(/^packages\/(opencode|core)\//, "packages/railwise/")
      return {
        upstream: row.file,
        railwise: file,
        exists: await Bun.file(file).exists(),
      }
    }),
)

const upstream = new Set(
  trees
    ? trees[1].tree.flatMap((item) => {
        if (item.type !== "tree") return []
        const prefix = ["packages/opencode/src/", "packages/core/src/"].find((value) => item.path.startsWith(value))
        if (!prefix) return []
        return item.path.slice(prefix.length).split("/")[0] || []
      })
    : (
        await Promise.all(
          ["packages/opencode/src", "packages/core/src"].map((dir) =>
            $`git ls-tree -d --name-only ${`${target}:${dir}`}`.quiet().nothrow(),
          ),
        )
      )
        .flatMap((result) => result.stdout.toString().trim().split("\n"))
        .filter(Boolean),
)
const current = new Set(
  (await readdir("packages/railwise/src", { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
)

const missing = [...upstream].filter((name) => !current.has(name)).sort()
const railwiseOnly = [...current].filter((name) => !upstream.has(name)).sort()
const exists = mapped.filter((row) => row.exists).length
const report = [
  `# opencode ${targetLabel} Sync Audit`,
  "",
  `Generated from ${baseLabel}..${targetLabel}.`,
  "",
  "## Summary",
  "",
  `- Changed files in scoped paths: ${rows.length}`,
  `- Upstream package path: packages/opencode`,
  `- Railwise package path: packages/railwise`,
  `- Direct git merge-base with Railwise HEAD: none expected for this fork snapshot`,
  "",
  "## Change Statuses",
  "",
  "| Status | Files |",
  "| --- | ---: |",
  table(statuses),
  "",
  "## Changed Scopes",
  "",
  "| Scope | Files |",
  "| --- | ---: |",
  table(scopes),
  "",
  "## Backend Modules Changed",
  "",
  "| packages/opencode/src module | Files |",
  "| --- | ---: |",
  table(backend),
  "",
  "## Core Modules Changed",
  "",
  "| packages/core/src module | Files |",
  "| --- | ---: |",
  table(core),
  "",
  "## App Areas Changed",
  "",
  "| packages/app/src area | Files |",
  "| --- | ---: |",
  table(app),
  "",
  "## Railwise Mapping Coverage",
  "",
  `- Upstream packages/opencode and packages/core changes: ${mapped.length}`,
  `- Existing mapped Railwise files: ${exists}`,
  `- Missing mapped Railwise files: ${mapped.length - exists}`,
  "",
  "## Upstream Modules Missing In Railwise",
  "",
  ...missing.map((name) => `- ${name}`),
  "",
  "## Railwise-Only Modules",
  "",
  ...railwiseOnly.map((name) => `- ${name}`),
  "",
  "## Recommended Migration Order",
  "",
  "1. Build and package scripts: keep Railwise naming, import upstream Windows/macOS build fixes only.",
  "2. Config and schema: migrate tolerant parsing, permission/model/schema fixes, then regenerate SDK.",
  "3. Server and session runtime: migrate API shape fixes, session sync, question handling, and event stream fixes.",
  "4. Tool/plugin/provider layer: migrate MCP/tool compatibility and provider request fixes.",
  "5. App shell: migrate prompt input, terminal websocket, global sync, and settings fixes while preserving Railwise agent studio.",
  "6. Validation: run package typecheck, focused tests, desktop build, and installer smoke checks.",
  "",
].join("\n")

console.log(report)
