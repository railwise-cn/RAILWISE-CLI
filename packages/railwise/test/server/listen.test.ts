import { describe, expect, test } from "bun:test"
import { Server } from "../../src/server/server"

describe("Server.listen", () => {
  test("includes Bun listen failure details", () => {
    const serve = Bun.serve
    const error = Object.assign(new Error("socket already busy"), { code: "EADDRINUSE" })

    try {
      Object.defineProperty(Bun, "serve", {
        value: (() => {
          throw error
        }) as unknown as typeof Bun.serve,
      })
      expect(() => Server.listen({ hostname: "127.0.0.1", port: 4096 })).toThrow(/EADDRINUSE|socket already busy/i)
    } finally {
      Object.defineProperty(Bun, "serve", {
        value: serve,
      })
    }
  })
})
