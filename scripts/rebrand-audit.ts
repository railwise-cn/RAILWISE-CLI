// scripts/rebrand-audit.ts
// 扫描桌面端发版面中的旧品牌命名，打印位置。
// 用法：
//   bun scripts/rebrand-audit.ts          (退出码 0=干净, 1=有残留 — CI 友好)

import { existsSync, readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

const ROOT = process.cwd()
const TARGETS = [
  ".github",
  "github",
  "workers",
  "docs/user",
  "docs/admin",
  "docs/dev",
  "packages/web/src/content/docs",
  "package.json",
  "packages/app/package.json",
  "packages/app/src",
  "packages/ui/src",
  "packages/desktop/package.json",
  "packages/desktop/src",
  "packages/desktop/src-tauri/src",
  "packages/railwise/package.json",
  "packages/railwise/src/index.ts",
  "packages/railwise/src/installation",
  "packages/railwise/src/plugin",
  "packages/railwise/src/server",
  "packages/railwise/src/session/prompt",
  "packages/railwise/src/cli/cmd/tui",
]

const TERMS = [
  ["open", "code"],
  ["anomaly", "co"],
  ["anomaly", ".co"],
  ["anomaly", "-labs"],
].map((parts) => parts.join(""))

const PATTERNS = TERMS.map((term) => new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "target",
  "dist",
  ".turbo",
  ".next",
  "build",
  "out",
  ".cache",
  "coverage",
])

const IGNORE_FILES = new Set(["scripts/rebrand-audit.ts"])

const TEXT_EXTS = new Set([
  ".ts",
  ".tsx",
  ".json",
  ".md",
  ".mdx",
  ".toml",
  ".yaml",
  ".yml",
  ".rs",
  ".sh",
  ".env",
  ".conf",
  ".txt",
])

let hits = 0

function scanFile(full: string) {
  const rel = relative(ROOT, full)
  if (rel.endsWith(".d.ts")) return
  if (rel.endsWith(".d.ts.map")) return
  if (rel.endsWith(".js")) return
  if (rel.endsWith(".js.map")) return
  const ext = full.slice(full.lastIndexOf("."))
  if (!TEXT_EXTS.has(ext)) return
  if (IGNORE_FILES.has(rel)) return

  let content
  try {
    content = readFileSync(full, "utf8")
  } catch {
    return
  }
  const lines = content.split("\n")

  lines.forEach((line, i) => {
    for (const p of PATTERNS) {
      p.lastIndex = 0
      if (p.test(line)) {
        console.log(`\x1b[33m${rel}\x1b[0m:${i + 1}  ${line.trim()}`)
        hits++
        break
      }
    }
  })
}

function scanDir(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    let stat
    try {
      stat = statSync(full)
    } catch {
      continue
    }
    const rel = relative(ROOT, full)

    if (stat.isDirectory()) {
      if (!IGNORE_DIRS.has(entry)) scanDir(full)
      continue
    }

    scanFile(full)
  }
}

console.log(`\n扫描目录: ${ROOT}\n`)
for (const target of TARGETS) {
  const full = join(ROOT, target)
  if (!existsSync(full)) continue
  const stat = statSync(full)
  if (stat.isDirectory()) scanDir(full)
  if (stat.isFile()) scanFile(full)
}

if (hits === 0) {
  console.log("\x1b[32m✓ 未发现残留字样，品牌替换完成。\x1b[0m")
} else {
  console.log(`\n\x1b[31m✗ 发现 ${hits} 处残留，请逐一修复。\x1b[0m`)
  process.exit(1)
}
