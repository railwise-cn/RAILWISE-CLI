import { mkdirSync, rmSync, symlinkSync } from "fs"
import { join } from "path"

const dir = join(".railwise", "node_modules")
mkdirSync(dir, { recursive: true })
const target = join(dir, "nb-railwise")
try { rmSync(target, { recursive: true }) } catch {}
symlinkSync(join("..", "..", "packages", "nb-railwise"), target, "junction")
