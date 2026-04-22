// scripts/rebrand-audit.ts
// 递归扫描仓库中残留的 opencode / anomaly 字样，打印位置。
// 用法：
//   bun scripts/rebrand-audit.ts          (退出码 0=干净, 1=有残留 — CI 友好)

import { readdirSync, readFileSync, statSync } from "fs"
import { join, relative } from "path"

const ROOT = process.cwd()

const PATTERNS = [
  /opencode/gi,
  /anomalyco/gi,
  /anomaly\.co/gi,
  /anomaly-labs/gi,
]

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

const IGNORE_FILES = new Set([
  "scripts/rebrand-audit.ts",
  "CHANGELOG.md",
])

const TEXT_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".json",
  ".md", ".toml", ".yaml", ".yml",
  ".rs", ".sh", ".env", ".conf",
])

let hits = 0

function scan(dir: string) {
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
      if (!IGNORE_DIRS.has(entry)) scan(full)
      continue
    }

    const ext = full.slice(full.lastIndexOf("."))
    if (!TEXT_EXTS.has(ext)) continue
    if (IGNORE_FILES.has(rel)) continue

    let content
    try {
      content = readFileSync(full, "utf8")
    } catch {
      continue
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
}

console.log(`\n扫描目录: ${ROOT}\n`)
scan(ROOT)

if (hits === 0) {
  console.log("\x1b[32m✓ 未发现残留字样，品牌替换完成。\x1b[0m")
} else {
  console.log(`\n\x1b[31m✗ 发现 ${hits} 处残留，请逐一修复。\x1b[0m`)
  process.exit(1)
}
