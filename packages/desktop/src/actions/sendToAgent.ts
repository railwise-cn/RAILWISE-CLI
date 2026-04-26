import type { Platform } from "@railwise/app"

type Server = {
  http: {
    url: string
    username?: string | null
    password?: string | null
  }
}

export async function sendToAgent(input: {
  platform: Platform
  server?: Server
  title: string
  prompt: string
}) {
  if (!input.server) {
    return "sidecar 未就绪，稍后再试。"
  }

  const headers = new Headers({ "Content-Type": "application/json" })
  if (input.server.http.password) {
    headers.set("Authorization", `Basic ${btoa(`${input.server.http.username ?? "railwise"}:${input.server.http.password}`)}`)
  }

  const create = await (input.platform.fetch ?? globalThis.fetch)(`${input.server.http.url}/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title: input.title }),
  })
  if (!create.ok) return `创建会话失败：HTTP ${create.status}`

  const session = (await create.json()) as { id: string }
  const response = await (input.platform.fetch ?? globalThis.fetch)(
    `${input.server.http.url}/session/${session.id}/prompt_async`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({
        parts: [{ type: "text", text: input.prompt }],
      }),
    },
  )

  if (!response.ok) return `发送失败：HTTP ${response.status}`
  return "已发送到 Agent 队列。"
}
