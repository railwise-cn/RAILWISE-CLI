#!/usr/bin/env bun

const args = Bun.argv.slice(2)

function arg(name: string, fallback?: string) {
  const i = args.indexOf(name)
  if (i < 0) return fallback
  return args[i + 1] ?? fallback
}

function positive(value: string | undefined) {
  const number = Number(value)
  if (!Number.isFinite(number)) return
  if (number <= 0) return
  return number
}

const seconds = positive(arg("--seconds", Bun.env.RAILWISE_SSE_SECONDS))
const minutes = positive(arg("--minutes", Bun.env.RAILWISE_SSE_MINUTES))
const duration = seconds ? seconds * 1_000 : (minutes ?? 30) * 60_000
const timeout = positive(arg("--heartbeat-timeout-ms", Bun.env.RAILWISE_SSE_HEARTBEAT_TIMEOUT_MS)) ?? 20_000
const base = arg("--url", Bun.env.RAILWISE_SERVER_URL ?? "http://127.0.0.1:4096") ?? "http://127.0.0.1:4096"
const url = new URL("/event", base)
const started = Date.now()
const abort = new AbortController()
const decoder = new TextDecoder()

let chunk = ""
let count = 0
let heartbeats = 0
let connected = false
let complete = false
let failed: string | undefined
let last = started

function data(frame: string) {
  return frame
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
}

function payload(text: string) {
  try {
    return JSON.parse(text) as { type?: unknown; payload?: { type?: unknown } }
  } catch {
    failed = `invalid SSE JSON after ${count} events`
    abort.abort()
  }
}

function handle(frame: string) {
  const text = data(frame)
  if (!text) return

  const event = payload(text)
  if (!event) return

  const type = typeof event.payload?.type === "string" ? event.payload.type : typeof event.type === "string" ? event.type : "unknown"
  last = Date.now()
  count += 1
  connected ||= type === "server.connected"
  if (type === "server.heartbeat") heartbeats += 1
}

function frames(text: string) {
  chunk += text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")

  while (true) {
    const i = chunk.indexOf("\n\n")
    if (i < 0) return
    handle(chunk.slice(0, i))
    chunk = chunk.slice(i + 2)
  }
}

const finish = setTimeout(() => {
  complete = true
  abort.abort()
}, duration)

const monitor = setInterval(() => {
  const elapsed = Date.now() - last
  if (elapsed <= timeout) return
  failed = `no SSE event received for ${elapsed}ms`
  abort.abort()
}, Math.min(1_000, timeout))

async function main() {
  console.log(`SSE soak: ${url.toString()} for ${Math.round(duration / 1_000)}s`)

  const res = await fetch(url, {
    signal: abort.signal,
    headers: {
      accept: "text/event-stream",
    },
  })

  if (!res.ok) throw new Error(`SSE endpoint returned ${res.status}`)
  if (!res.body) throw new Error("SSE endpoint returned no response body")

  const reader = res.body.getReader()

  while (!complete && !failed) {
    const next = await reader.read().catch((error: unknown) => {
      if (complete) return { done: true, value: undefined }
      failed = error instanceof Error ? error.message : "SSE stream read failed"
      return { done: true, value: undefined }
    })

    if (complete || failed) break
    if (next.done) {
      failed = "SSE stream ended before soak duration completed"
      break
    }

    frames(decoder.decode(next.value, { stream: true }))
  }

  if (!connected) failed = "SSE stream did not receive server.connected"
  if (failed) throw new Error(failed)

  console.log(`SSE soak passed: ${count} events, ${heartbeats} heartbeats, ${Date.now() - started}ms`)
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => {
    clearTimeout(finish)
    clearInterval(monitor)
  })
