import { describe, expect, test } from "bun:test"
import { Harness } from "../../src/harness"
import { Identifier } from "../../src/id/id"
import { PermissionNext } from "../../src/permission/next"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import type { MessageV2 } from "../../src/session/message-v2"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

function assistant(input: { sessionID: string; parentID: string; time: number }): MessageV2.Assistant {
  return {
    id: Identifier.ascending("message"),
    sessionID: input.sessionID,
    role: "assistant",
    time: {
      created: input.time,
      completed: input.time + 600,
    },
    parentID: input.parentID,
    modelID: "deepseek-v4",
    providerID: "deepseek",
    mode: "build",
    agent: "chief_manager",
    path: {
      cwd: ".",
      root: ".",
    },
    cost: 0,
    tokens: {
      total: 0,
      input: 0,
      output: 0,
      reasoning: 0,
      cache: {
        read: 0,
        write: 0,
      },
    },
    finish: "end_turn",
  }
}

describe("Harness service", () => {
  test("maps session messages into visible runtime events", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.createNext({
          directory: tmp.path,
          title: "复测资料检查",
        })
        const user = await Session.updateMessage({
          id: Identifier.ascending("message"),
          sessionID: session.id,
          role: "user",
          time: { created: session.time.created + 100 },
          agent: "chief_manager",
          model: {
            providerID: "deepseek",
            modelID: "deepseek-v4",
          },
        })
        const reply = await Session.updateMessage(
          assistant({
            sessionID: session.id,
            parentID: user.id,
            time: session.time.created + 200,
          }),
        )
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: reply.id,
          type: "tool",
          callID: "call_read",
          tool: "read",
          state: {
            status: "completed",
            input: { path: "CP3/成果表.xlsx" },
            output: "读取完成",
            title: "读取复测成果表",
            metadata: {},
            time: {
              start: session.time.created + 300,
              end: session.time.created + 700,
            },
          },
        })
        await Session.updatePart({
          id: Identifier.ascending("part"),
          sessionID: session.id,
          messageID: reply.id,
          type: "patch",
          hash: "abc",
          files: ["交付物清单.md"],
        })

        const events = await Harness.timeline({ sessionID: session.id })

        expect(events.map((item) => item.type)).toEqual([
          "session.started",
          "agent.selected",
          "model.selected",
          "artifact.created",
          "tool.completed",
          "session.completed",
        ])
        expect(events.find((item) => item.type === "tool.completed")).toMatchObject({
          title: "工具完成：读取复测成果表",
          duration: 400,
          risk: "low",
        })
        expect(events.find((item) => item.type === "artifact.created")?.artifactPath).toBe("交付物清单.md")
      },
    })
  })

  test("reports pending permissions in status and timeline", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.createNext({
          directory: tmp.path,
          title: "权限测试",
        })
        const ask = PermissionNext.ask({
          id: Identifier.ascending("permission"),
          sessionID: session.id,
          permission: "bash",
          patterns: ["rm -rf output"],
          metadata: {},
          always: [],
          ruleset: [],
        })

        expect((await Harness.status({ sessionID: session.id })).pendingPermissionCount).toBe(1)
        expect(await Harness.timeline({ sessionID: session.id })).toContainEqual(
          expect.objectContaining({
            type: "permission.requested",
            title: "等待权限：bash",
            risk: "high",
          }),
        )

        const permission = (await PermissionNext.list())[0]
        await Harness.resolvePermission({ permissionID: permission.id })
        await expect(ask).resolves.toBeUndefined()
      },
    })
  })

  test("scopes pending permissions to the requested workspace status", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const target = await Session.createNext({
          directory: tmp.path,
          title: "目标工作区",
        })
        const other = await Session.createNext({
          directory: `${tmp.path}/other`,
          title: "其他工作区",
        })
        const asks = [
          PermissionNext.ask({
            id: Identifier.ascending("permission"),
            sessionID: target.id,
            permission: "bash",
            patterns: ["cat target"],
            metadata: {},
            always: [],
            ruleset: [],
          }),
          PermissionNext.ask({
            id: Identifier.ascending("permission"),
            sessionID: other.id,
            permission: "bash",
            patterns: ["cat other"],
            metadata: {},
            always: [],
            ruleset: [],
          }),
        ]

        expect((await Harness.status()).pendingPermissionCount).toBe(2)
        expect((await Harness.status({ directory: tmp.path })).pendingPermissionCount).toBe(1)
        expect((await Harness.status({ sessionID: target.id })).pendingPermissionCount).toBe(1)

        for (const permission of await PermissionNext.list()) {
          await Harness.resolvePermission({ permissionID: permission.id })
        }
        await Promise.all(asks)
      },
    })
  })
})
