import { expect, test } from "bun:test"
import { permissionReplyInput } from "./permission-reply"

test("permissionReplyInput maps legacy UI decisions to Harness replies", () => {
  expect(
    permissionReplyInput({
      sessionID: "ses_123",
      permissionID: "perm_123",
      response: "once",
      directory: "/tmp/project",
    }),
  ).toEqual({
    requestID: "perm_123",
    reply: "once",
    directory: "/tmp/project",
  })
})
