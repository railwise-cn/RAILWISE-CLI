#!/usr/bin/env bun

import fs from "node:fs/promises"
import net from "node:net"
import os from "node:os"
import path from "node:path"
import { $ } from "bun"

import { SIDECAR_BINARIES, windowsify } from "./utils"

const arg = (name: string) => {
  const i = Bun.argv.indexOf(name)
  if (i < 0) return
  return Bun.argv[i + 1]
}

const host = () => {
  if (process.platform === "darwin") return process.arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (process.platform === "linux")
    return process.arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  if (process.platform === "win32") return "x86_64-pc-windows-msvc"
  throw new Error(`Unsupported native smoke platform '${process.platform}'`)
}

const free = () =>
  new Promise<number>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      server.close(() => {
        if (!address || typeof address === "string") return reject(new Error("Could not allocate a local port"))
        resolve(address.port)
      })
    })
  })

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const preserve = async (file: string, dir: string) => {
  const existed = await Bun.file(file).exists()
  const backup = path.join(dir, Buffer.from(file).toString("base64url"))
  const stat = existed ? await fs.stat(file) : undefined
  if (existed) await fs.copyFile(file, backup)
  return { backup, existed, file, mode: stat?.mode }
}
const restore = async (item: Awaited<ReturnType<typeof preserve>>) => {
  if (!item.existed) {
    await fs.rm(item.file, { force: true })
    return
  }

  await fs.copyFile(item.backup, item.file)
  if (item.mode) await fs.chmod(item.file, item.mode)
}
const cleanup = async (port: number) => {
  if (process.platform === "win32") return

  const ps = Bun.spawnSync(["ps", "-axo", "pid=,command="], { stdout: "pipe", stderr: "ignore" })
  const pids = new TextDecoder()
    .decode(ps.stdout)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("railwise-cli") && line.includes(`--port ${port}`))
    .map((line) => Number(line.split(/\s+/, 1)[0]))
    .filter((pid) => Number.isInteger(pid) && pid > 0 && pid !== process.pid)

  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM")
    } catch {}
  }
  await sleep(500)
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
  }
}
const wait = async (port: number, done: Promise<number>, timeout: number) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const exited = await Promise.race([done.then((code) => ({ code })), sleep(0).then(() => undefined)])
    if (exited) throw new Error(`Native shell exited before sidecar became healthy (exit ${exited.code})`)

    const healthy = await fetch(`http://127.0.0.1:${port}/global/health`, { signal: AbortSignal.timeout(500) })
      .then((res) => res.ok)
      .catch(() => false)
    if (healthy) return
    await sleep(250)
  }

  throw new Error(`Timed out waiting for native sidecar health on port ${port}`)
}

const target = arg("--target") ?? Bun.env.TAURI_ENV_TARGET_TRIPLE ?? Bun.env.RUST_TARGET ?? host()
if (target !== host()) throw new Error(`Native smoke can only run for the host target (${host()}), got '${target}'`)
if (!SIDECAR_BINARIES.some((item) => item.rustTarget === target)) {
  throw new Error(`Sidecar configuration not available for Rust target '${target}'`)
}

const timeout = Number(arg("--timeout") ?? Bun.env.RAILWISE_NATIVE_SMOKE_TIMEOUT_MS ?? "90000")
const root = path.resolve(import.meta.dir, "..")
const tmp = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), "railwise-native-smoke-"))
const sidecar = path.join(root, windowsify(`src-tauri/sidecars/railwise-cli-${target}`))
const port = await free()
const entry = path.join(tmp, process.platform === "win32" ? "sidecar.ts" : "sidecar.js")
const data = path.join(tmp, "data")
const debug = path.join(root, "src-tauri", "target", "debug", "railwise-cli")
const debugPaths = [...new Set([debug, windowsify(debug)])]
const app = path.join(root, windowsify(path.join("src-tauri", "target", "debug", "railwise")))
let web: ReturnType<typeof Bun.serve> | undefined
let code: number | undefined

await fs.mkdir(path.dirname(sidecar), { recursive: true })
const saved = await Promise.all([sidecar, ...debugPaths].map((file) => preserve(file, tmp)))

await Bun.write(
  entry,
  `
const args = Bun.argv.slice(2)
const value = (name, fallback) => {
  const i = args.indexOf(name)
  if (i < 0) return fallback
  return args[i + 1] ?? fallback
}

if (args[0] === "debug" && args[1] === "config") {
  console.log("{}")
  process.exit(0)
}

if (args.includes("--version")) {
  console.log("1.3.0")
  process.exit(0)
}

if (!args.includes("serve")) {
  console.error("RAILWISE native smoke sidecar received unsupported args: " + args.join(" "))
  process.exit(64)
}

const server = Bun.serve({
  hostname: value("--hostname", "127.0.0.1"),
  port: Number(value("--port", "0")),
  fetch: (req) => {
    const url = new URL(req.url)
    if (url.pathname === "/global/health") return Response.json({ ok: true, smoke: "native-tauri" })
    if (url.pathname === "/event") {
      return new Response("data: {\\"type\\":\\"server.connected\\"}\\n\\n", {
        headers: { "content-type": "text/event-stream" },
      })
    }
    return Response.json({ ok: true })
  },
})

console.log("sqlite-migration:done")
console.error("RAILWISE native smoke sidecar listening on " + server.hostname + ":" + server.port)

const stop = () => {
  server.stop(true)
  process.exit(0)
}
process.on("SIGINT", stop)
process.on("SIGTERM", stop)
await new Promise(() => {})
`,
)
await $`bun build --compile --outfile ${sidecar} ${entry}`.quiet()
if (process.platform !== "win32") await fs.chmod(sidecar, 0o755)

await fs.mkdir(path.join(data, "railwise"), { recursive: true })
await Bun.write(path.join(data, "railwise", "railwise.db"), "")
const frontend = await fetch("http://localhost:1420", { signal: AbortSignal.timeout(300) })
  .then((res) => res.ok)
  .catch(() => false)
if (!frontend) {
  try {
    web = Bun.serve({
      hostname: "127.0.0.1",
      port: 1420,
      fetch: () =>
        new Response('<!doctype html><meta charset="utf-8"><title>RAILWISE Native Smoke</title>', {
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
    })
  } catch {}
}

await $`cd src-tauri && cargo build`
await fs.mkdir(path.dirname(debug), { recursive: true })
for (const file of debugPaths) await fs.copyFile(sidecar, file)

const child = Bun.spawn([app], {
  cwd: path.join(root, "src-tauri"),
  env: {
    ...Bun.env,
    NO_COLOR: "1",
    RAILWISE_NATIVE_SMOKE: "1",
    RAILWISE_PORT: String(port),
    RUST_LOG: Bun.env.RUST_LOG ?? "info",
    XDG_DATA_HOME: data,
  },
  stdout: "pipe",
  stderr: "pipe",
})
const done = child.exited.then((value) => {
  code = value
  return value
})
let output = ""
const collect = async (stream: ReadableStream<Uint8Array> | null) => {
  if (!stream) return
  for await (const chunk of stream) output += new TextDecoder().decode(chunk)
}
const readers = [collect(child.stdout), collect(child.stderr)]

try {
  await wait(port, done, timeout)
  await sleep(750)
  console.log(`Native Tauri smoke passed: shell launched and sidecar health responded on ${port}.`)
} catch (error) {
  console.error(output.trim())
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
} finally {
  child.kill("SIGINT")
  await Promise.race([done.catch(() => 1), sleep(5_000)])
  if (code === undefined) child.kill("SIGKILL")
  await Promise.race([done.catch(() => 1), sleep(3_000)])
  await cleanup(port)
  await Promise.allSettled(readers)
  web?.stop(true)
  await Promise.all(saved.map(restore))
  await fs.rm(tmp, { force: true, recursive: true })
}
