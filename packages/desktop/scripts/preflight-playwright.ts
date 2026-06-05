#!/usr/bin/env bun

const args = Bun.argv.slice(2)
const arg = (name: string, fallback?: string) => {
  const index = args.indexOf(name)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}

const url = new URL(arg("--base-url", Bun.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${Bun.env.PLAYWRIGHT_PORT ?? "5185"}`)!)
const host = arg("--host", url.hostname || "127.0.0.1")!
const port = Number(arg("--port", url.port || Bun.env.PLAYWRIGHT_PORT || "5185"))
const base = `${url.protocol}//${host}:${port}`
const reachable = await fetch(base, { signal: AbortSignal.timeout(2_000) })
  .then((res) => res.ok || res.status < 500)
  .catch(() => false)

if (reachable) {
  console.log(`Playwright preflight passed: existing server is reachable at ${base}`)
  process.exit(0)
}

const code = [
  `const server = Bun.listen({ hostname: ${JSON.stringify(host)}, port: ${port}, socket: { open() {}, data() {}, close() {} } })`,
  "server.stop(true)",
  'console.log("ok")',
].join("\n")
const result = Bun.spawnSync(["bun", "--eval", code], {
  stdout: "pipe",
  stderr: "pipe",
})
const text = `${result.stderr.toString()}\n${result.stdout.toString()}`

if (result.exitCode === 0) {
  console.log(`Playwright preflight passed: ${host}:${port} can be used for Vite`)
  process.exit(0)
}

if (text.includes("EPERM")) {
  console.error(
    [
      `Playwright preflight failed: this shell cannot listen on ${host}:${port}.`,
      "Bun.listen returned EPERM, so Vite/Playwright would report a misleading port startup failure.",
      "Run the live E2E command from a normal macOS Terminal or CI, or set PLAYWRIGHT_BASE_URL to an already running dev server.",
    ].join("\n"),
  )
  process.exit(2)
}

if (text.includes("EADDRINUSE") || text.includes("already in use")) {
  console.error(
    [
      `Playwright preflight failed: ${host}:${port} is already in use and no reusable server responded at ${base}.`,
      "Set PLAYWRIGHT_PORT to a free port, stop the old server, or set PLAYWRIGHT_BASE_URL to the reusable server.",
    ].join("\n"),
  )
  process.exit(1)
}

console.error([`Playwright preflight failed for ${host}:${port}.`, text.trim()].filter(Boolean).join("\n"))
process.exit(1)
