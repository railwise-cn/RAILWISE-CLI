import { expect, test } from "bun:test"
import path from "path"

test("project technical writer preserves workflow artifact paths", async () => {
  const writer = await Bun.file(
    path.join(import.meta.dir, "../../../..", ".railwise", "agent", "technical_writer.md"),
  ).text()

  expect(writer).toContain("工作流附件约束")
  expect(writer).toContain("附件引用")
  expect(writer).toContain("Markdown 路径与 JSON 路径")
})
