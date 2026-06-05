#!/usr/bin/env bun

import worker from "./index.js"

type Env = {
  UPDATE_KV: {
    get: (key: string) => Promise<string | null>
  }
}

type Manifest = {
  version: string
  notes: string
  pub_date: string
  rollout_percentage?: number
  platforms: Record<string, { signature: string; url: string }>
}

const checks: { name: string; passed: boolean; detail: string }[] = []
const platform = "darwin-aarch64"
const intel = "darwin-x86_64"
const manifest: Manifest = {
  version: "1.3.1",
  notes: "GA 灰度验证",
  pub_date: "2026-04-26T00:00:00Z",
  rollout_percentage: 100,
  platforms: {
    [platform]: {
      signature: "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZQ==",
      url: "https://cdn.railwise.cn/desktop/1.3.1/railwise-desktop-darwin-aarch64.app.tar.gz",
    },
    [intel]: {
      signature: "dW50cnVzdGVkIGNvbW1lbnQ6IGludGVsIHNpZ25hdHVyZQ==",
      url: "https://cdn.railwise.cn/desktop/1.3.1/railwise-desktop-darwin-x64.app.tar.gz",
    },
  },
}

function env(value: Manifest | null): Env {
  return {
    UPDATE_KV: {
      get: async (key) => (key === "latest" && value ? JSON.stringify(value) : null),
    },
  }
}

function request(path: string, country?: string) {
  const req = new Request(`https://updates.railwise.cn${path}`, {
    headers: { "X-Tauri-Machine-Id": "m7-ga-machine" },
  }) as Request & { cf?: { country?: string } }
  req.cf = country ? { country } : undefined
  return req
}

async function json(path: string, country?: string, value = manifest) {
  const res = await worker.fetch(request(path, country), env(value))
  const body = res.status === 200 ? ((await res.json()) as Manifest) : undefined
  return { res, body }
}

async function check(name: string, run: () => Promise<{ passed: boolean; detail: string }>) {
  const result = await run()
  checks.push({ name, ...result })
}

await check("invalid route returns 404", async () => {
  const res = await worker.fetch(request("/health"), env(manifest))
  return { passed: res.status === 404, detail: `status ${res.status}` }
})

await check("empty manifest returns 204", async () => {
  const res = await worker.fetch(request(`/desktop/${platform}/1.3.0`), env(null))
  return { passed: res.status === 204, detail: `status ${res.status}` }
})

await check("same version returns 204", async () => {
  const res = await worker.fetch(request(`/desktop/${platform}/1.3.1`), env(manifest))
  return { passed: res.status === 204, detail: `status ${res.status}` }
})

await check("older client receives update", async () => {
  const { res, body } = await json(`/desktop/${platform}/1.3.0`, "CN")
  return {
    passed:
      res.status === 200 &&
      body?.version === "1.3.1" &&
      body.platforms[platform]?.url === "https://cdn.railwise.cn/desktop/1.3.1/railwise-desktop-darwin-aarch64.app.tar.gz",
    detail: `status ${res.status}, version ${body?.version ?? "none"}`,
  }
})

await check("unsupported platform returns 404", async () => {
  const res = await worker.fetch(request("/desktop/windows-x86_64/1.3.0"), env(manifest))
  return { passed: res.status === 404, detail: `status ${res.status}` }
})

await check("intel client receives update", async () => {
  const { res, body } = await json(`/desktop/${intel}/1.3.0`, "CN")
  return {
    passed:
      res.status === 200 &&
      body?.platforms[intel]?.url === "https://cdn.railwise.cn/desktop/1.3.1/railwise-desktop-darwin-x64.app.tar.gz",
    detail: `status ${res.status}, url ${body?.platforms[intel]?.url ?? "none"}`,
  }
})

await check("rollout zero suppresses update", async () => {
  const res = await worker.fetch(request(`/desktop/${platform}/1.3.0`), env({ ...manifest, rollout_percentage: 0 }))
  return { passed: res.status === 204, detail: `status ${res.status}` }
})

await check("global CDN is selected outside CN", async () => {
  const { res, body } = await json(`/desktop/${platform}/1.3.0`, "US")
  return {
    passed: res.status === 200 && body?.platforms[platform]?.url.startsWith("https://cdn-global.railwise.io/"),
    detail: body?.platforms[platform]?.url ?? `status ${res.status}`,
  }
})

await check("response disables cache", async () => {
  const { res } = await json(`/desktop/${platform}/1.3.0`, "CN")
  return { passed: res.headers.get("Cache-Control") === "no-store", detail: res.headers.get("Cache-Control") ?? "none" }
})

for (const item of checks) console.log(`${item.passed ? "[ok]" : "[fail]"} ${item.name}: ${item.detail}`)

const failed = checks.filter((item) => !item.passed)
if (failed.length > 0) {
  console.error(`\n${failed.length} update server check(s) failed.`)
  process.exit(1)
}

console.log(`\nUpdate server readiness passed (${checks.length} checks).`)
