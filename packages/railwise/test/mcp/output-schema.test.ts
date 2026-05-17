import { beforeEach, expect, mock, test } from "bun:test"

const calls = {
  listTools: 0,
  request: 0,
}

mock.module("@modelcontextprotocol/sdk/client/stdio.js", () => ({
  StdioClientTransport: class MockStdio {
    stderr = undefined
    async close() {}
  },
}))

mock.module("@modelcontextprotocol/sdk/client/index.js", () => ({
  Client: class MockClient {
    async connect() {}
    setNotificationHandler() {}
    async close() {}
    async listTools() {
      calls.listTools++
      throw new Error("outputSchema can't resolve reference #/$defs/missing")
    }
    async request() {
      calls.request++
      return {
        tools: [
          {
            name: "repair-report",
            description: "Create a repair report",
            inputSchema: {
              type: "object",
              properties: {},
            },
            outputSchema: {
              $ref: "#/$defs/missing",
            },
          },
        ],
      }
    }
  },
}))

beforeEach(() => {
  calls.listTools = 0
  calls.request = 0
})

const { MCP } = await import("../../src/mcp/index")
const { Instance } = await import("../../src/project/instance")
const { tmpdir } = await import("../fixture/fixture")

test("keeps MCP tools when outputSchema validation fails", async () => {
  await using tmp = await tmpdir()

  await Instance.provide({
    directory: tmp.path,
    fn: async () => {
      const added = await MCP.add("schema-server", {
        type: "local",
        command: ["schema-server"],
      })

      expect(added.status).toMatchObject({
        "schema-server": {
          status: "connected",
        },
      })

      const tools = await MCP.tools()
      expect(tools["schema-server_repair-report"]).toBeDefined()
      expect(calls.listTools).toBe(2)
      expect(calls.request).toBe(2)
    },
  })
})
