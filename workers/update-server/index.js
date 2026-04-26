export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    const parts = url.pathname.split("/").filter(Boolean)

    if (parts.length < 3 || parts[0] !== "desktop") {
      return new Response("Not Found", { status: 404 })
    }

    const target = parts[1]
    const current = parts[2]
    const raw = await env.UPDATE_KV.get("latest")
    if (!raw) return new Response(null, { status: 204 })

    const latest = JSON.parse(raw)
    if (!isNewer(latest.version, current)) {
      return new Response(null, { status: 204 })
    }

    const machine = request.headers.get("X-Tauri-Machine-Id") ?? url.searchParams.get("mid") ?? ""
    const rollout = latest.rollout_percentage ?? 100
    if ((await hashMod(machine, 100)) >= rollout) {
      return new Response(null, { status: 204 })
    }

    const platform = latest.platforms?.[target]
    if (!platform) {
      return new Response("Platform Not Supported", { status: 404 })
    }

    const cdn = request.cf?.country === "CN" ? "https://cdn.railwise.cn" : "https://cdn-global.railwise.io"
    const asset = platform.url.startsWith("https://cdn")
      ? platform.url.replace(/^https:\/\/cdn[^/]*/, cdn)
      : platform.url

    return new Response(
      JSON.stringify({
        version: latest.version,
        notes: latest.notes,
        pub_date: latest.pub_date,
        platforms: {
          [target]: {
            ...platform,
            url: asset,
          },
        },
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
        },
      },
    )
  },
}

function isNewer(a, b) {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)

  for (let i = 0; i < 3; i++) {
    if ((left[i] ?? 0) > (right[i] ?? 0)) return true
    if ((left[i] ?? 0) < (right[i] ?? 0)) return false
  }

  return false
}

async function hashMod(input, mod) {
  if (!input) return 0
  const data = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest("SHA-256", data)
  return new DataView(buf).getUint32(0, false) % mod
}
