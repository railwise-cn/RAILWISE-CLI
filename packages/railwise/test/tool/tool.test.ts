import { expect, test } from "bun:test"
import z from "zod"
import { Harness } from "../../src/harness"
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

test("tool execution records Harness lifecycle events", async () => {
  Harness.clear("ses_tool_success")
  const info = Tool.define("probe", {
    description: "test tool",
    parameters: z.object({
      name: z.string(),
    }),
    async execute(params) {
      return {
        title: `probe ${params.name}`,
        output: "ok",
        metadata: {},
      }
    },
  })

  const tool = await info.init()
  await tool.execute({ name: "harness" }, { ...ctx, sessionID: "ses_tool_success", callID: "call_probe" })

  expect(Harness.timeline("ses_tool_success").map((event) => event.type)).toEqual(["tool.started", "tool.completed"])
  expect((await Harness.status({ workspace: "/tmp/railwise" })).runningToolCount).toBe(0)
  Harness.clear("ses_tool_success")
})

test("tool execution records Harness failure events", async () => {
  Harness.clear("ses_tool_failure")
  const info = Tool.define(
    "explode",
    {
      description: "test tool",
      parameters: z.object({}),
      async execute() {
        throw new Error("boom")
      },
    },
  )

  const tool = await info.init()
  await expect(tool.execute({}, { ...ctx, sessionID: "ses_tool_failure", callID: "call_explode" })).rejects.toThrow(
    "boom",
  )

  const timeline = Harness.timeline("ses_tool_failure")
  expect(timeline.map((event) => event.type)).toEqual(["tool.started", "tool.failed"])
  expect(timeline[1]?.error).toBe("boom")
  expect((await Harness.status({ workspace: "/tmp/railwise" })).runningToolCount).toBe(0)
  Harness.clear("ses_tool_failure")
})

test("tool execution records generated artifacts", async () => {
  Harness.clear("ses_tool_artifact")
  const info = Tool.define("deliver", {
    description: "test tool",
    parameters: z.object({}),
    async execute() {
      return {
        title: "生成报告",
        output: "done",
        metadata: {
          truncated: true,
          outputPath: "/tmp/railwise/report.md",
        },
        attachments: [
          {
            type: "file",
            url: "file:///tmp/railwise/checklist.xlsx",
            filename: "checklist.xlsx",
            mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          },
        ],
      }
    },
  })

  const tool = await info.init()
  await tool.execute({}, { ...ctx, sessionID: "ses_tool_artifact", callID: "call_deliver" })

  const artifacts = Harness.timeline("ses_tool_artifact").filter((event) => event.type === "artifact.created")
  expect(artifacts.map((event) => event.artifactPath)).toEqual([
    "/tmp/railwise/report.md",
    "file:///tmp/railwise/checklist.xlsx",
  ])
  Harness.clear("ses_tool_artifact")
})
