#!/usr/bin/env bun

import path from "node:path"

type Step = {
  name: string
  cwd: string
  args?: string[]
  env?: Record<string, string | undefined>
  retry?: number
  run?: () => Promise<number>
  skip?: boolean
}

const root = path.resolve(import.meta.dir, "..")
const args = Bun.argv.slice(2)
const has = (name: string) => args.includes(name)
const env = (value?: Record<string, string | undefined>) => {
  if (!value) return
  return Object.fromEntries(
    Object.entries({
      ...Bun.env,
      ...Object.fromEntries(Object.entries(value).filter((item): item is [string, string] => item[1] !== undefined)),
    }).filter((item): item is [string, string] => item[1] !== undefined),
  )
}
const value = (name: string) => {
  const i = args.indexOf(name)
  if (i < 0) return
  return args[i + 1]
}

const full = has("--full")
const live = has("--live") || full
const e2eBase = Bun.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${Bun.env.PLAYWRIGHT_PORT ?? "5185"}`
const chrome =
  Bun.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ??
  ((await Bun.file(
    "/Users/WANGJIAWEI/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell",
  ).exists())
    ? "/Users/WANGJIAWEI/Library/Caches/ms-playwright/chromium_headless_shell-1217/chrome-headless-shell-mac-arm64/chrome-headless-shell"
    : undefined)
const reachable = live
  ? await fetch(e2eBase, { signal: AbortSignal.timeout(3_000) })
      .then((res) => res.ok)
      .catch(() => false)
  : false
const sseSeconds = value("--sse-seconds") ?? Bun.env.RAILWISE_VERIFY_SSE_SECONDS ?? (full ? undefined : "10")
const sseDuration =
  (sseSeconds
    ? Number(sseSeconds) * 1_000
    : Number(value("--sse-minutes") ?? Bun.env.RAILWISE_VERIFY_SSE_MINUTES ?? "30") * 60_000) || 30 * 60_000
const sseTimeout = Number(Bun.env.RAILWISE_SSE_HEARTBEAT_TIMEOUT_MS ?? "20000")
const sseUrl = new URL("/event", Bun.env.RAILWISE_SERVER_URL ?? "http://127.0.0.1:4096")
const hints = [
  live ? undefined : "Live checks skipped. Run `bun run desktop:verify -- --live` for SSE smoke and desktop E2E.",
  full ? undefined : "Run `bun run desktop:verify -- --full` before release for the 30-minute SSE acceptance.",
].filter((item): item is string => Boolean(item))

async function sse() {
  const abort = new AbortController()
  const decoder = new TextDecoder()
  const started = Date.now()

  let chunk = ""
  let connected = false
  let count = 0
  let heartbeats = 0
  let last = started
  let failed: string | undefined

  const finish = setTimeout(() => abort.abort(), sseDuration)
  const monitor = setInterval(
    () => {
      const elapsed = Date.now() - last
      if (elapsed <= sseTimeout) return
      failed = `no SSE event received for ${elapsed}ms`
      abort.abort()
    },
    Math.min(1_000, sseTimeout),
  )

  const frame = (text: string) => {
    const data = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
    if (!data) return

    const event = JSON.parse(data) as { type?: unknown; payload?: { type?: unknown } }
    const type =
      typeof event.payload?.type === "string"
        ? event.payload.type
        : typeof event.type === "string"
          ? event.type
          : "unknown"
    connected ||= type === "server.connected"
    if (type === "server.heartbeat") heartbeats += 1
    count += 1
    last = Date.now()
  }

  try {
    console.log(`SSE soak: ${sseUrl.toString()} for ${Math.round(sseDuration / 1_000)}s`)
    const res = await fetch(sseUrl, { signal: abort.signal, headers: { accept: "text/event-stream" } })
    if (!res.ok) throw new Error(`SSE endpoint returned ${res.status}`)
    if (!res.body) throw new Error("SSE endpoint returned no response body")

    const reader = res.body.getReader()
    while (Date.now() - started < sseDuration && !failed) {
      const next = await reader.read().catch(() => ({ done: true, value: undefined }))
      if (Date.now() - started >= sseDuration) break
      if (next.done) throw new Error("SSE stream ended before soak duration completed")

      chunk += decoder.decode(next.value, { stream: true }).replace(/\r\n/g, "\n").replace(/\r/g, "\n")
      while (true) {
        const i = chunk.indexOf("\n\n")
        if (i < 0) break
        frame(chunk.slice(0, i))
        chunk = chunk.slice(i + 2)
      }
    }

    if (!connected) throw new Error("SSE stream did not receive server.connected")
    if (failed) throw new Error(failed)
    console.log(`SSE soak passed: ${count} events, ${heartbeats} heartbeats, ${Date.now() - started}ms`)
    return 0
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    return 1
  } finally {
    clearTimeout(finish)
    clearInterval(monitor)
  }
}

const steps: Step[] = [
  {
    name: "品牌残留扫描",
    cwd: root,
    args: ["bun", "run", "script/rebrand-audit.ts"],
  },
  {
    name: "M6 发布配置验收",
    cwd: root,
    args: ["bun", "run", "script/verify-desktop-release.ts"],
  },
  {
    name: "M7 内测验收",
    cwd: root,
    args: ["bun", "run", "script/verify-desktop-m7.ts"],
  },
  {
    name: "更新分发服务验收",
    cwd: root,
    args: ["bun", "run", "script/verify-update-server"],
  },
  {
    name: "app typecheck",
    cwd: path.join(root, "packages/app"),
    args: ["bun", "run", "typecheck"],
  },
  {
    name: "ui typecheck",
    cwd: path.join(root, "packages/ui"),
    args: ["bun", "run", "typecheck"],
  },
  {
    name: "desktop typecheck",
    cwd: path.join(root, "packages/desktop"),
    args: ["bun", "run", "typecheck"],
  },
  {
    name: "railwise typecheck",
    cwd: path.join(root, "packages/railwise"),
    args: ["bun", "run", "typecheck"],
  },
  {
    name: "SSE 耐久验收",
    cwd: path.join(root, "packages/desktop"),
    run: sse,
    retry: 1,
    skip: has("--skip-sse") || !live,
  },
  {
    name: "desktop E2E",
    cwd: path.join(root, "packages/desktop"),
    args: ["bun", "run", "test:e2e"],
    env: {
      PLAYWRIGHT_SKIP_WEBSERVER: Bun.env.PLAYWRIGHT_SKIP_WEBSERVER ?? (reachable || live ? "1" : undefined),
      PLAYWRIGHT_BASE_URL: e2eBase,
      PLAYWRIGHT_CHROMIUM_EXECUTABLE: chrome,
    },
    retry: 1,
    skip: has("--skip-e2e") || !live,
  },
]

let failed = 0

for (const step of steps) {
  if (step.skip) {
    console.log(`- ${step.name}: skipped`)
    continue
  }

  const tries = (step.retry ?? 0) + 1
  let code = 1
  for (let i = 0; i < tries; i++) {
    if (code === 0) break
    console.log(`\n==> ${step.name}${i > 0 ? ` (retry ${i})` : ""}`)
    if (step.run) {
      code = await step.run()
      continue
    }
    const result = Bun.spawnSync(step.args ?? [], {
      cwd: step.cwd,
      env: env(step.env),
      stdout: "inherit",
      stderr: "inherit",
    })
    code = result.exitCode
  }

  if (code === 0) {
    console.log(`✓ ${step.name}`)
    continue
  }

  failed += 1
  console.error(`✗ ${step.name} failed with exit code ${code}`)
}

if (failed > 0) {
  console.error(`\n${failed} acceptance step(s) failed.`)
  process.exit(1)
}

for (const hint of hints) console.log(hint)
console.log("\nDesktop acceptance passed.")
