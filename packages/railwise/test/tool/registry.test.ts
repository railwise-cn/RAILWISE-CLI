import { describe, expect, test } from "bun:test"
import path from "path"
import fs from "fs/promises"
import { tmpdir } from "../fixture/fixture"
import { Instance } from "../../src/project/instance"
import { ToolRegistry } from "../../src/tool/registry"
import { Marketplace } from "../../src/marketplace"

describe("tool.registry", () => {
  test("loads tools from .railwise/tool (singular)", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const railwiseDir = path.join(dir, ".railwise")
        await fs.mkdir(railwiseDir, { recursive: true })

        const toolDir = path.join(railwiseDir, "tool")
        await fs.mkdir(toolDir, { recursive: true })

        await Bun.write(
          path.join(toolDir, "hello.ts"),
          [
            "export default {",
            "  description: 'hello tool',",
            "  args: {},",
            "  execute: async () => {",
            "    return 'hello world'",
            "  },",
            "}",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("hello")
      },
    })
  })

  test("loads tools from .railwise/tools (plural)", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const railwiseDir = path.join(dir, ".railwise")
        await fs.mkdir(railwiseDir, { recursive: true })

        const toolsDir = path.join(railwiseDir, "tools")
        await fs.mkdir(toolsDir, { recursive: true })

        await Bun.write(
          path.join(toolsDir, "hello.ts"),
          [
            "export default {",
            "  description: 'hello tool',",
            "  args: {},",
            "  execute: async () => {",
            "    return 'hello world'",
            "  },",
            "}",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("hello")
      },
    })
  })

  test("loads tools with external dependencies without crashing", async () => {
    await using tmp = await tmpdir({
      init: async (dir) => {
        const railwiseDir = path.join(dir, ".railwise")
        await fs.mkdir(railwiseDir, { recursive: true })

        const toolsDir = path.join(railwiseDir, "tools")
        await fs.mkdir(toolsDir, { recursive: true })

        await Bun.write(
          path.join(railwiseDir, "package.json"),
          JSON.stringify({
            name: "custom-tools",
            dependencies: {
              "nb-railwise": "^0.0.0",
              cowsay: "^1.6.0",
            },
          }),
        )

        await Bun.write(
          path.join(toolsDir, "cowsay.ts"),
          [
            "import { say } from 'cowsay'",
            "export default {",
            "  description: 'tool that imports cowsay at top level',",
            "  args: { text: { type: 'string' } },",
            "  execute: async ({ text }: { text: string }) => {",
            "    return say({ text })",
            "  },",
            "}",
            "",
          ].join("\n"),
        )
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const ids = await ToolRegistry.ids()
        expect(ids).toContain("cowsay")
      },
    })
  })

  test("desktop tools follow marketplace local capability toggles", async () => {
    const client = process.env.RAILWISE_CLIENT
    process.env.RAILWISE_CLIENT = "desktop"
    await Marketplace.reset()
    await using tmp = await tmpdir()

    try {
      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const ids = await ToolRegistry.ids()

          expect(ids).toContain("read")
          expect(ids).not.toContain("bash")
          expect(ids).not.toContain("write")

          await Marketplace.setEnabled("railwise.mcp.local_tools", true)

          const next = await ToolRegistry.ids()

          expect(next).toContain("bash")
          expect(next).toContain("write")
        },
      })
    } finally {
      if (client === undefined) delete process.env.RAILWISE_CLIENT
      else process.env.RAILWISE_CLIENT = client
      await Marketplace.reset()
    }
  })
})
