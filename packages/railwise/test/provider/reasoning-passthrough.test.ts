import { createGroq } from "@ai-sdk/groq"
import { createXai } from "@ai-sdk/xai"
import { expect, test } from "bun:test"

const response = (model: string) =>
  Response.json({
    id: "response-1",
    created: 0,
    model,
    object: "chat.completion",
    choices: [{ index: 0, message: { role: "assistant", content: "Hello" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  })

test("xAI passes through xhigh reasoning effort", async () => {
  let body: Record<string, unknown> | undefined
  const fetch = Object.assign(
    async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
      body = JSON.parse(String(init?.body))
      return response("grok-4")
    },
    { preconnect: globalThis.fetch.preconnect },
  )
  const model = createXai({ apiKey: "test", fetch }).chat("grok-4")

  await model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    providerOptions: { xai: { reasoningEffort: "xhigh" } },
  })

  expect(body?.reasoning_effort).toBe("xhigh")
})

test("Groq passes through custom reasoning effort", async () => {
  let body: Record<string, unknown> | undefined
  const fetch = Object.assign(
    async (_input: Parameters<typeof globalThis.fetch>[0], init?: RequestInit) => {
      body = JSON.parse(String(init?.body))
      return response("openai/gpt-oss-120b")
    },
    { preconnect: globalThis.fetch.preconnect },
  )
  const model = createGroq({ apiKey: "test", fetch })("openai/gpt-oss-120b")

  await model.doGenerate({
    prompt: [{ role: "user", content: [{ type: "text", text: "Hello" }] }],
    providerOptions: { groq: { reasoningEffort: "custom" } },
  })

  expect(body?.reasoning_effort).toBe("custom")
})
