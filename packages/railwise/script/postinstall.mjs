#!/usr/bin/env node

import fs from "fs"
import os from "os"
import path from "path"
import { spawnSync } from "child_process"
import { createRequire } from "module"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"))

function platform() {
  if (os.platform() === "darwin") return "darwin"
  if (os.platform() === "linux") return "linux"
  if (os.platform() === "win32") return "windows"
  return os.platform()
}

function arch() {
  if (os.arch() === "x64") return "x64"
  if (os.arch() === "arm64") return "arm64"
  if (os.arch() === "arm") return "arm"
  return os.arch()
}

const system = platform()
const cpu = arch()
const base = `railwise-${system}-${cpu}`
const binary = system === "windows" ? "railwise.exe" : "railwise"

function supportsAvx2() {
  if (cpu !== "x64") return false

  if (system === "linux") {
    if (!fs.existsSync("/proc/cpuinfo")) return false
    return /(^|\s)avx2(\s|$)/i.test(fs.readFileSync("/proc/cpuinfo", "utf8"))
  }

  if (system === "darwin") {
    const result = spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], {
      encoding: "utf8",
      timeout: 1500,
    })
    if (result.status !== 0) return false
    return (result.stdout || "").trim() === "1"
  }

  if (system === "windows") {
    const cmd =
      '(Add-Type -MemberDefinition "[DllImport(""kernel32.dll"")] public static extern bool IsProcessorFeaturePresent(int ProcessorFeature);" -Name Kernel32 -Namespace Win32 -PassThru)::IsProcessorFeaturePresent(40)'
    return ["powershell.exe", "pwsh.exe", "pwsh", "powershell"].some((exe) => {
      const result = spawnSync(exe, ["-NoProfile", "-NonInteractive", "-Command", cmd], {
        encoding: "utf8",
        timeout: 3000,
        windowsHide: true,
      })
      if (result.status !== 0) return false
      return ["true", "1"].includes((result.stdout || "").trim().toLowerCase())
    })
  }

  return false
}

function musl() {
  if (system !== "linux") return false
  if (fs.existsSync("/etc/alpine-release")) return true
  const result = spawnSync("ldd", ["--version"], { encoding: "utf8" })
  return `${result.stdout || ""}${result.stderr || ""}`.toLowerCase().includes("musl")
}

function names() {
  const baseline = cpu === "x64" && !supportsAvx2()

  if (system === "linux") {
    if (musl()) {
      if (cpu === "x64") {
        if (baseline) return [`${base}-baseline-musl`, `${base}-musl`, `${base}-baseline`, base]
        return [`${base}-musl`, `${base}-baseline-musl`, base, `${base}-baseline`]
      }
      return [`${base}-musl`, base]
    }

    if (cpu === "x64") {
      if (baseline) return [`${base}-baseline`, base, `${base}-baseline-musl`, `${base}-musl`]
      return [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`]
    }
    return [base, `${base}-musl`]
  }

  if (cpu === "x64") {
    if (baseline) return [`${base}-baseline`, base]
    return [base, `${base}-baseline`]
  }
  return [base]
}

function optional(name) {
  const file = require.resolve(`${name}/package.json`)
  const dir = path.dirname(file)
  const found = path.join(dir, "bin", binary)
  if (!fs.existsSync(found)) throw new Error(`Binary not found at ${found}`)
  return found
}

function vendor(name) {
  return path.join(__dirname, "vendor", name, "bin", binary)
}

function run(exe, args) {
  const result = spawnSync(exe, args, { stdio: "inherit", windowsHide: true })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${exe} exited with ${result.status}`)
}

function quote(value) {
  return `'${value.replace(/'/g, "''")}'`
}

function extract(file, dir) {
  if (file.endsWith(".tar.gz")) {
    run("tar", ["-xzf", file, "-C", dir])
    return
  }

  if (system === "windows") {
    const cmd = `Expand-Archive -Path ${quote(file)} -DestinationPath ${quote(dir)} -Force`
    const exe = ["powershell.exe", "pwsh.exe", "pwsh", "powershell"].find((item) => {
      const result = spawnSync(item, ["-NoProfile", "-NonInteractive", "-Command", "$PSVersionTable.PSVersion"], {
        stdio: "ignore",
        windowsHide: true,
      })
      return result.status === 0
    })
    if (!exe) throw new Error("PowerShell is required to extract the Windows binary fallback")
    run(exe, ["-NoProfile", "-NonInteractive", "-Command", cmd])
    return
  }

  run("unzip", ["-oq", file, "-d", dir])
}

function timeout() {
  const value = Number(process.env.RAILWISE_DOWNLOAD_TIMEOUT_MS || 60000)
  if (Number.isFinite(value) && value > 0) return value
  return 60000
}

async function download(name) {
  const ext = system === "linux" ? ".tar.gz" : ".zip"
  const asset = `${name}${ext}`
  const base = (
    process.env.RAILWISE_RELEASE_BASE_URL ||
    `https://github.com/railwise-cn/RAILWISE-CLI/releases/download/v${pkg.version}`
  ).replace(/\/+$/, "")
  const url = `${base}/${asset}`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout())
  console.log(`Downloading ${asset} from ${base}`)

  const tmp = path.join(os.tmpdir(), `${asset}.${process.pid}`)
  const dir = path.join(__dirname, "vendor", name, "bin")
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": `railwise-postinstall/${pkg.version}` },
    })
    if (!res.ok) throw new Error(`Download failed for ${asset}: ${res.status} ${res.statusText}`)

    fs.rmSync(path.dirname(dir), { recursive: true, force: true })
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(tmp, Buffer.from(await res.arrayBuffer()))
    extract(tmp, dir)
  } finally {
    clearTimeout(timer)
    fs.rmSync(tmp, { force: true })
  }

  const found = vendor(name)
  if (!fs.existsSync(found)) throw new Error(`Downloaded asset did not contain ${binary}`)
  if (system !== "windows") fs.chmodSync(found, 0o755)
  return found
}

async function main() {
  const items = names()
  const installed = items.flatMap((name) => {
    try {
      return [optional(name)]
    } catch {
      return []
    }
  })[0]
  if (installed) {
    console.log(`Platform binary verified at: ${installed}`)
    return
  }

  const found = await items.reduce(async (prev, name) => {
    const value = await prev
    if (value) return value
    try {
      return await download(name)
    } catch (error) {
      console.warn(`Could not install fallback binary ${name}: ${error instanceof Error ? error.message : String(error)}`)
      return undefined
    }
  }, Promise.resolve(undefined))

  if (!found) throw new Error(`Could not install a RAILWISE binary for ${system}/${cpu}`)
  console.log(`Platform binary downloaded to: ${found}`)
}

main().catch((error) => {
  console.error("Failed to setup railwise binary:", error instanceof Error ? error.message : String(error))
  process.exit(1)
})
