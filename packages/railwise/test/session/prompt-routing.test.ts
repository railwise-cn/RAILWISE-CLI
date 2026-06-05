import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import path from "path"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionPrompt } from "../../src/session/prompt"
import { tmpdir } from "../fixture/fixture"

function routing(parts: MessageV2.Part[]) {
  return parts.find((part) => part.type === "text" && part.synthetic && part.text.includes("<railwise_routing>"))
}

describe("session prompt capability routing", () => {
  test("persists routing hints for explicit and keyword-matched engineering tools", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const message = await SessionPrompt.prompt({
          sessionID: session.id,
          noReply: true,
          parts: [
            {
              type: "text",
              text: "请检查当前线路复测资料，并按 tool: railwise.tool.survey_calculator_leveling_closure. 完成计算。",
            },
          ],
        })
        const stored = await MessageV2.get({ sessionID: session.id, messageID: message.info.id })
        const part = routing(stored.parts)

        expect(part?.type).toBe("text")
        if (part?.type !== "text") throw new Error("expected routing text")
        expect(part.text).toContain("survey_calculator_leveling_closure")
        expect(part.text).toContain("resurvey_material_check")
        expect(part.text).toContain("推荐工具")
      },
    })
  })

  test("recommends project skills that match the current business task", async () => {
    const prev = process.env.RAILWISE_DISABLE_BUILTIN_SKILLS
    process.env.RAILWISE_DISABLE_BUILTIN_SKILLS = "1"

    try {
      await using tmp = await tmpdir({
        git: true,
        init: async (dir) => {
          const root = path.join(dir, ".railwise", "skill", "resurvey-review")
          await fs.mkdir(root, { recursive: true })
          await Bun.write(
            path.join(root, "SKILL.md"),
            `---
name: 复测资料审查
description: 复测资料审查流程，检查控制点、外业观测、平差成果和交接签认资料。
---

# 复测资料审查
`,
          )
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({})
          const message = await SessionPrompt.prompt({
            sessionID: session.id,
            noReply: true,
            parts: [{ type: "text", text: "请做复测资料审查，列出缺失资料和下一步处理建议。" }],
          })
          const stored = await MessageV2.get({ sessionID: session.id, messageID: message.info.id })
          const part = routing(stored.parts)

          expect(part?.type).toBe("text")
          if (part?.type !== "text") throw new Error("expected routing text")
          expect(part.text).toContain("推荐 Skill")
          expect(part.text).toContain('call tool "skill" with name="复测资料审查"')
        },
      })
    } finally {
      if (prev === undefined) delete process.env.RAILWISE_DISABLE_BUILTIN_SKILLS
      else process.env.RAILWISE_DISABLE_BUILTIN_SKILLS = prev
    }
  })
})
