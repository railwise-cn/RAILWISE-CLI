#!/usr/bin/env bun

import { $ } from "bun"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"

type Config = {
  identifier?: string
  mainBinaryName?: string
  productName?: string
}

const args = Bun.argv.slice(2)

const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const config = (await Bun.file("src-tauri/tauri.prod.conf.json").json()) as Config
const name = config.productName ?? "睿威智测 RAILWISE"
const identifier = config.identifier ?? "com.railwiseai.desktop"
const executable = config.mainBinaryName ?? "railwise"
const app = arg("--app", path.join("src-tauri", "target", "release", "bundle", "macos", `${name}.app`))!
const timeout = Number(arg("--timeout", "15"))
const readyTimeout = Number(arg("--ready-timeout", "60"))
const skipLaunch = args.includes("--skip-launch")
const skipReady = args.includes("--skip-ready")
const skipProcessCheck = args.includes("--skip-process-check")
const skipProcessCleanup = skipProcessCheck || args.includes("--skip-process-cleanup")

const logDirs = () => {
  const home = Bun.env.HOME
  if (!home) return []
  return [
    path.join(home, "Library", "Logs", identifier),
    path.join(home, "Library", "Logs", `${identifier}.dev`),
    path.join(home, "Library", "Logs", "ai.railwise.desktop.dev"),
  ]
}

const logFiles = async (since: number) => {
  const files = await Promise.all(
    logDirs().map(async (dir) =>
      (
        await Promise.all(
          (await readdir(dir).catch(() => []))
            .filter((item) => item.startsWith("railwise-desktop_") && item.endsWith(".log"))
            .map(async (item) => {
              const file = path.join(dir, item)
              const info = await stat(file).catch(() => undefined)
              return info && info.mtimeMs >= since - 2_000 ? file : undefined
            }),
        )
      ).filter((item): item is string => Boolean(item)),
    ),
  )
  return files.flat().sort()
}

const tail = (text: string) => text.split("\n").slice(-80).join("\n")
const sidecar = path.join(app, "Contents", "MacOS", "railwise-cli")

const value = (input: string, name: string) => input.match(new RegExp(`--${name}\\s+([^\\s]+)`))?.[1]

const sidecars = async () =>
  (await $`pgrep -f ${sidecar}`.quiet().nothrow()).stdout.toString().trim().split("\n").filter(Boolean)

const sidecarUrls = async () =>
  (
    await Promise.all(
      (await sidecars()).map(async (pid) => {
        const args = (await $`ps -p ${pid} -o args=`.quiet().nothrow()).stdout.toString()
        const port = value(args, "port")
        if (!port) return
        return `http://${value(args, "hostname") ?? "127.0.0.1"}:${port}/global/health`
      }),
    )
  ).filter((item): item is string => Boolean(item))

const readyFromHttp = async () => {
  for (const url of await sidecarUrls()) {
    const res = await fetch(url, { signal: AbortSignal.timeout(1_000) }).catch(() => undefined)
    if (res?.status === 200 || res?.status === 401) {
      console.log(`macOS app sidecar ready from ${url} (HTTP ${res.status})`)
      return true
    }
  }

  return false
}

const probeLoopback = () => {
  try {
    const server = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch() {
        return new Response("ok")
      },
    })
    const url = server.url.href
    server.stop(true)
    return { ok: true, detail: url }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : String(err) }
  }
}

const waitForReady = async (since: number) => {
  const deadline = Date.now() + readyTimeout * 1_000
  let latest = ""
  let seen: string[] = []

  while (Date.now() < deadline) {
    for (const file of await logFiles(since)) {
      seen.push(file)
      const text = await Bun.file(file)
        .text()
        .catch(() => "")
      latest = text || latest
      if (text.includes("CLI health check OK") || text.includes("Loading done, completing initialisation")) {
        console.log(`macOS app sidecar ready from ${file}`)
        return
      }
      if (text.includes("Failed to spawn RAILWISE Server")) {
        throw new Error(`macOS app reported server startup failure in ${file}\n${tail(text)}`)
      }
    }

    if (!skipProcessCheck && (await running()).length === 0) {
      throw new Error(`macOS app process exited before sidecar was ready.\n${tail(latest)}`)
    }

    if (await readyFromHttp()) return

    await sleep(500)
  }

  throw new Error(
    [
      `macOS app did not report sidecar readiness within ${readyTimeout}s.`,
      seen.length > 0
        ? `Observed logs:\n${Array.from(new Set(seen)).join("\n")}`
        : `No railwise-desktop_*.log files found under ${logDirs().join(", ")}`,
      tail(latest),
    ].join("\n"),
  )
}

if ((await stat(app).catch(() => undefined))?.isDirectory() !== true) throw new Error(`App bundle not found: ${app}`)

await $`bun ./scripts/verify-macos-bundle.ts --app ${app}`

if (skipLaunch) {
  console.log(`Skipped macOS launch smoke for ${app}`)
  process.exit(0)
}

if (!skipReady) {
  const loopback = probeLoopback()
  if (!loopback.ok) {
    throw new Error(
      [
        "Current shell cannot bind a local loopback port, so a full macOS app launch smoke cannot verify the sidecar server from this environment.",
        `Loopback probe failed: ${loopback.detail}`,
        "Run this smoke command from a normal macOS Terminal or Finder session, or use --skip-launch for bundle-only verification inside a sandboxed agent shell.",
      ].join("\n"),
    )
  }
}

const running = async () =>
  (await $`pgrep -x ${executable}`.quiet().nothrow()).stdout.toString().trim().split("\n").filter(Boolean)

if (!skipProcessCleanup) {
  for (const pid of await running()) {
    await $`kill ${pid}`.quiet().nothrow()
  }
}

const launched = Date.now()
const opened = await $`open -n ${app}`.quiet().nothrow()
if (opened.exitCode !== 0) {
  const message = `${opened.stderr}\n${opened.stdout}`.trim()
  throw new Error(
    [
      `Failed to launch macOS app with open -n: ${app}`,
      message,
      "If Safari.app also fails to open from this shell, LaunchServices is blocked by the current environment; rerun this smoke command from a normal macOS Terminal or Finder session.",
    ].join("\n"),
  )
}

if (!skipProcessCheck) {
  const started = Date.now()
  let pids: string[] = []
  while (Date.now() - started < timeout * 1000) {
    pids = await running()
    if (pids.length > 0) break
    await sleep(500)
  }

  if (pids.length === 0) throw new Error(`macOS app process did not appear within ${timeout}s: ${executable}`)

  await sleep(3000)
  pids = await running()
  if (pids.length === 0) throw new Error(`macOS app process exited during smoke window: ${executable}`)
} else {
  await sleep(3000)
}

const files = await readdir(path.join(app, "Contents", "MacOS"))
if (!files.includes(executable) || !files.includes("railwise-cli")) {
  throw new Error(`macOS app bundle is missing expected executables: ${files.join(", ")}`)
}

if (!skipReady) await waitForReady(launched)

console.log(`macOS app launch smoke passed for ${app}`)
