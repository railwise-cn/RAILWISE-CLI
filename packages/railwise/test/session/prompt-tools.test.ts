import { describe, expect, spyOn, test } from "bun:test"
import { jsonSchema, tool } from "ai"
import { Agent } from "../../src/agent/agent"
import { Marketplace } from "../../src/marketplace"
import { MCP } from "../../src/mcp"
import { Instance } from "../../src/project/instance"
import type { Provider } from "../../src/provider/provider"
import { Session } from "../../src/session"
import { SessionPrompt } from "../../src/session/prompt"
import { tmpdir } from "../fixture/fixture"

const model: Provider.Model = {
  id: "test-model",
  providerID: "railwise",
  api: {
    id: "test-model",
    npm: "@ai-sdk/openai-compatible",
    url: "https://example.invalid/v1",
  },
  name: "Test Model",
  capabilities: {
    temperature: true,
    reasoning: false,
    attachment: true,
    toolcall: true,
    input: {
      text: true,
      audio: false,
      image: true,
      video: false,
      pdf: true,
    },
    output: {
      text: true,
      audio: false,
      image: false,
      video: false,
      pdf: false,
    },
    interleaved: false,
  },
  cost: {
    input: 0,
    output: 0,
    cache: {
      read: 0,
      write: 0,
    },
  },
  limit: {
    context: 128_000,
    output: 16_000,
  },
  status: "active",
  options: {},
  headers: {},
  release_date: "2026-01-01",
}

describe("session.prompt marketplace tools", () => {
  test("desktop only injects MCP tools after local tools are enabled", async () => {
    const client = process.env.RAILWISE_CLIENT
    process.env.RAILWISE_CLIENT = "desktop"
    await Marketplace.reset()

    const mcp = spyOn(MCP, "tools").mockImplementation(async () => ({
      railwise_external: tool({
        description: "External MCP tool",
        inputSchema: jsonSchema({ type: "object", properties: {} }),
        async execute() {
          return {
            content: [{ type: "text" as const, text: "ok" }],
          }
        },
      }),
    }))

    try {
      await using tmp = await tmpdir({ git: true })
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({})
          const agent = await Agent.get("build")
          const processor = {
            message: {
              id: "msg_test",
              sessionID: session.id,
              role: "assistant" as const,
              parentID: "msg_parent",
              modelID: model.id,
              providerID: model.providerID,
              mode: "build",
              agent: agent.name,
              path: {
                cwd: tmp.path,
                root: tmp.path,
              },
              cost: 0,
              tokens: {
                input: 0,
                output: 0,
                reasoning: 0,
                cache: {
                  read: 0,
                  write: 0,
                },
              },
              time: {
                created: Date.now(),
              },
            },
            partFromToolCall: () => undefined,
            async process() {
              throw new Error("unused")
            },
          } as unknown as Parameters<typeof SessionPrompt.resolveTools>[0]["processor"]

          const hidden = await SessionPrompt.resolveTools({
            agent,
            model,
            session,
            processor,
            bypassAgentCheck: false,
            messages: [],
          })

          expect(hidden.railwise_external).toBeUndefined()
          expect(mcp).toHaveBeenCalledTimes(0)

          await Marketplace.setEnabled("railwise.mcp.local_tools", true)

          const visible = await SessionPrompt.resolveTools({
            agent,
            model,
            session,
            processor,
            bypassAgentCheck: false,
            messages: [],
          })

          expect(visible.railwise_external).toBeDefined()
          expect(mcp).toHaveBeenCalledTimes(1)
        },
      })
    } finally {
      mcp.mockRestore()
      await Marketplace.reset()
      if (client === undefined) delete process.env.RAILWISE_CLIENT
      else process.env.RAILWISE_CLIENT = client
    }
  })
})
