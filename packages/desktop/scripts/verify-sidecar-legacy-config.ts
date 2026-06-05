#!/usr/bin/env bun

import { mkdtemp, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { RUST_TARGET } from "./utils"

const args = Bun.argv.slice(2)
const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}
const exists = async (file: string) => Boolean(await stat(file).catch(() => undefined))
const tail = (value: string) => value.split("\n").slice(-40).join("\n")
const json = (value: string) => {
  const start = value.indexOf("{")
  const end = value.lastIndexOf("}")
  if (start < 0 || end < start) throw new Error(`No JSON config found in sidecar output:\n${tail(value)}`)
  return JSON.parse(value.slice(start, end + 1)) as {
    version?: string
    system?: { profile?: string }
    permission?: Record<string, string>
  }
}

const target = arg("--target", RUST_TARGET)
const bin = arg(
  "--bin",
  target ? path.join("src-tauri", "sidecars", `railwise-cli-${target}`) : undefined,
)
if (!bin) throw new Error("Missing --bin, --target or RUST_TARGET")
if (!(await exists(bin))) throw new Error(`Sidecar binary not found: ${bin}`)

const blocked = [
  "RAILWISE_CONFIG",
  "RAILWISE_CONFIG_DIR",
  "RAILWISE_CONFIG_CONTENT",
  "RAILWISE_PERMISSION",
  "RAILWISE_TEST_HOME",
]
const base = Object.fromEntries(
  Object.entries(Bun.env).filter((item): item is [string, string] => item[1] !== undefined && !blocked.includes(item[0])),
)
const legacy = {
  version: "1.3.0",
  system: {
    profile: "desktop-sidecar-legacy-config",
  },
  tools: {
    surveying: ["read", "write"],
    monitoring: ["grep"],
    analysis: true,
  },
}

await using tmp = {
  path: await mkdtemp(path.join(os.tmpdir(), "railwise-sidecar-config-")),
  async [Symbol.asyncDispose]() {
    await rm(this.path, { recursive: true, force: true }).catch(() => undefined)
  },
}

const result = Bun.spawnSync([path.resolve(bin), "debug", "config"], {
  cwd: tmp.path,
  env: {
    ...base,
    RAILWISE_DISABLE_BUILTIN_CONFIG: "1",
    RAILWISE_DISABLE_MODELS_FETCH: "1",
    RAILWISE_DISABLE_PROJECT_CONFIG: "1",
    RAILWISE_CONFIG_CONTENT: JSON.stringify(legacy),
    RAILWISE_TEST_HOME: path.join(tmp.path, "home"),
    XDG_CACHE_HOME: path.join(tmp.path, "cache"),
    XDG_CONFIG_HOME: path.join(tmp.path, "config"),
    XDG_DATA_HOME: path.join(tmp.path, "data"),
    XDG_STATE_HOME: path.join(tmp.path, "state"),
  },
  stdout: "pipe",
  stderr: "pipe",
})

const output = `${result.stdout.toString()}\n${result.stderr.toString()}`
if (result.exitCode !== 0) {
  console.error(tail(output))
  process.exit(result.exitCode || 1)
}

const config = json(output)
if (config.version !== legacy.version) throw new Error(`Legacy version metadata was not preserved: ${config.version ?? "missing"}`)
if (config.system?.profile !== legacy.system.profile) {
  throw new Error(`Legacy system metadata was not preserved: ${config.system?.profile ?? "missing"}`)
}
if (config.permission?.read !== "allow") throw new Error("Legacy tools array did not grant read permission")
if (config.permission?.edit !== "allow") throw new Error("Legacy tools array did not grant edit permission")
if (config.permission?.grep !== "allow") throw new Error("Legacy tools array did not grant grep permission")
if (config.permission?.analysis !== "allow") throw new Error("Legacy boolean tool did not grant analysis permission")

console.log(`Sidecar legacy config compatibility passed: ${bin}`)
