import { expect, test } from "bun:test"
import z from "zod"
import { Tool } from "../../src/tool/tool"

const ctx: Tool.Context = {
  sessionID: "ses_test",
  messageID: "msg_test",
  agent: "build",
  abort: new AbortController().signal,
  messages: [],
  metadata() {},
  ask: async () => {},
}

test("tool execution receives parsed parameters", async () => {
  const schema = z.object({
    count: z.coerce.number(),
  })
  const info = Tool.define("coerce", {
    description: "test tool",
    parameters: schema,
    async execute(params) {
      return {
        title: "coerce",
        output: `${typeof params.count}:${params.count}`,
        metadata: {},
      }
    },
  })

  const tool = await info.init()
  const result = await tool.execute({ count: "2" } as unknown as z.infer<typeof schema>, ctx)

  expect(result.output).toBe("number:2")
})
