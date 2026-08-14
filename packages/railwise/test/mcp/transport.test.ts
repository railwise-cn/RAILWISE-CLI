import { expect, test } from "bun:test"
import path from "node:path"

test("does not reconnect an SSE stream after a JSON-RPC error response", async () => {
  const proc = Bun.spawn([process.execPath, path.join(import.meta.dir, "../fixture/mcp-transport.ts")], {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [code, stdout, stderr] = await Promise.all([
    proc.exited,
    Bun.readableStreamToText(proc.stdout),
    Bun.readableStreamToText(proc.stderr),
  ])

  expect(stderr).toBe("")
  expect(code).toBe(0)
  expect(stdout.trim()).toBe("1")
})
