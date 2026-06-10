import { describe, expect } from "bun:test"
import { Effect, Schema } from "effect"
import { RAILWISE, Session, Tool } from "@railwise/core/public"
import { testEffect } from "./lib/effect"

const it = testEffect(RAILWISE.layer)

describe("public native RAILWISE API", () => {
  it.effect("exposes only the intentional Session capabilities", () =>
    Effect.gen(function* () {
      const railwise = yield* RAILWISE.Service

      expect(Object.keys(railwise).sort()).toEqual(["sessions", "tools"])

      expect(Object.keys(railwise.sessions).sort()).toEqual([
        "context",
        "create",
        "events",
        "get",
        "list",
        "message",
        "messages",
        "prompt",
      ])
      expect(Session.ID.create()).toStartWith("ses_")
      expect(Session.MessageID.create()).toStartWith("msg_")
      expect(yield* railwise.sessions.list()).toBeArray()
      yield* railwise.tools.attach({
        public_tool: Tool.make({
          description: "Public tool",
          parameters: Schema.Struct({}),
          success: Schema.Struct({ ok: Schema.Boolean }),
          execute: () => Effect.succeed({ ok: true }),
        }),
      })
    }),
  )
})
