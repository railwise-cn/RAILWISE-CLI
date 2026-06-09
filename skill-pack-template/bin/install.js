#!/usr/bin/env node

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const pkg = require(path.join(__dirname, "..", "package.json"))
const args = process.argv.slice(2)
const command = args.find((item) => !item.startsWith("-")) || "install"

function option(name) {
  const index = args.indexOf(name)
  if (index === -1) return undefined
  return args[index + 1]
}

function flag(name) {
  return args.includes(name)
}

function home(file) {
  if (!file) return file
  if (file === "~") return os.homedir()
  if (file.startsWith("~/")) return path.join(os.homedir(), file.slice(2))
  return file
}

function custom(target) {
  if (!target) return false
  if (path.isAbsolute(home(target))) return true
  return target.startsWith(".") || target.startsWith("~") || target.includes("/")
}

function customCtx(root) {
  return {
    name: "custom",
    root,
    layout: {
      agent: "agent",
      skill: "skill",
      command: "command",
      tool: "tool",
      template: "templates",
      theme: "themes",
    },
  }
}

function target(name) {
  const value = name || "railwise"
  const dest = option("--dest")
  if (dest) return customCtx(home(dest))
  if (value === "custom") throw new Error("Target 'custom' requires --dest <path>")
  if (custom(value)) return customCtx(home(value))
  if (value === "codex") {
    return {
      name: value,
      root: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
      layout: {
        agent: "agents",
        skill: "skills",
        command: "prompts",
        tool: "tools",
        template: "templates",
        theme: "themes",
      },
    }
  }
  if (value === "claude") {
    return {
      name: value,
      root: process.env.CLAUDE_HOME || path.join(os.homedir(), ".claude"),
      layout: {
        agent: "agents",
        skill: "skills",
        command: "commands",
        tool: "tools",
        template: "templates",
        theme: "themes",
      },
    }
  }
  if (value === "opencode") {
    return {
      name: value,
      root: process.env.OPENCODE_HOME || path.join(os.homedir(), ".config", "opencode"),
      layout: {
        agent: "agent",
        skill: "skill",
        command: "command",
        tool: "tool",
        template: "templates",
        theme: "themes",
      },
    }
  }
  if (value === "railwise") {
    return {
      name: value,
      root: process.env.RAILWISE_HOME || path.join(os.homedir(), ".railwise"),
      layout: {
        agent: "agent",
        skill: "skill",
        command: "command",
        tool: "tool",
        template: "templates",
        theme: "themes",
      },
    }
  }
  throw new Error(`Unknown target: ${value}`)
}

function assets() {
  return Array.isArray(pkg.agentAssets) ? pkg.agentAssets : []
}

function destination(ctx, asset) {
  const dir = ctx.layout[asset.kind]
  if (!dir) throw new Error(`Target ${ctx.name} does not support ${asset.kind}`)
  return path.join(ctx.root, dir, asset.name)
}

function install(ctx, asset) {
  const source = path.join(__dirname, "..", asset.dir)
  const dest = destination(ctx, asset)
  if (!fs.existsSync(source)) throw new Error(`Missing asset source: ${asset.dir}`)
  if (fs.existsSync(dest)) {
    if (!flag("--force") && !flag("--dry-run")) throw new Error(`${dest} exists. Pass --force to replace it.`)
    if (!flag("--dry-run")) fs.rmSync(dest, { recursive: true, force: true })
  }
  if (flag("--dry-run")) {
    console.log(`${asset.kind}/${asset.name} -> ${dest}`)
    return
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.cpSync(source, dest, { recursive: true })
  console.log(`${asset.kind}/${asset.name} -> ${dest}`)
}

if (command === "list") {
  for (const asset of assets()) console.log(`${asset.kind}/${asset.name}`)
  process.exit(0)
}

const ctx = target(option("--target"))

if (command === "where") {
  console.log(ctx.root)
  for (const [kind, dir] of Object.entries(ctx.layout)) console.log(`${kind}: ${path.join(ctx.root, dir)}`)
  process.exit(0)
}

if (command !== "install") throw new Error(`Unknown command: ${command}`)

for (const asset of assets()) install(ctx, asset)
