#!/usr/bin/env bun

import { readFile, writeFile } from "node:fs/promises"
import path from "node:path"

const args = Bun.argv.slice(2)
const keys = ["automatic_checks", "terminal_smoke", "finder_launch", "manual_checklist", "beta_decision"] as const
const allowed = new Set(["passed", "failed", "pending"])
const fail = (message: string): never => {
  console.error(message)
  process.exit(1)
}

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}
const field = (name: string) => {
  const value = arg(`--${name.replaceAll("_", "-")}`)
  if (!value) return
  if (!allowed.has(value)) fail(`Invalid ${name}: ${value}. Use passed, failed, or pending.`)
  return value
}

const doc = arg("--doc", path.join("..", "..", "docs", "dev", "13-desktop-beta-manual-check.md"))!
const source = await readFile(path.resolve(doc), "utf8")
const current = Object.fromEntries(
  keys.map((key) => [key, source.match(new RegExp(`- ${key}=([^\\n]+)`))?.[1]?.trim() ?? "pending"]),
) as Record<(typeof keys)[number], string>
const next = {
  ...current,
  ...Object.fromEntries(keys.map((key) => [key, field(key)]).filter((entry): entry is [string, string] => Boolean(entry[1]))),
}

if (args.includes("--all-passed")) {
  next.finder_launch = "passed"
  next.manual_checklist = "passed"
  next.beta_decision = "passed"
}

if (next.beta_decision === "passed") {
  const missing = ["automatic_checks", "terminal_smoke", "finder_launch", "manual_checklist"].filter((key) => next[key] !== "passed")
  if (missing.length > 0) fail(`Cannot mark beta_decision=passed until these are passed: ${missing.join(", ")}`)
}

const block = [
  "<!-- manual-acceptance-status:start -->",
  ...keys.map((key) => `- ${key}=${next[key]}`),
  "<!-- manual-acceptance-status:end -->",
].join("\n")
const start = "<!-- manual-acceptance-status:start -->"
const end = "<!-- manual-acceptance-status:end -->"

if (!source.includes(start) || !source.includes(end)) fail(`Manual acceptance status block not found in ${doc}`)

await writeFile(path.resolve(doc), source.replace(new RegExp(`${start}[\\s\\S]*?${end}`), block))

console.log(keys.map((key) => `${key}=${next[key]}`).join("\n"))
