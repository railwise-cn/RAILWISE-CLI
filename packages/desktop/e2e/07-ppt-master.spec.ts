import { expect, test } from "./helpers/app"

test("ppt_master 全链路生成汇报 PPT", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  const ids = await page.evaluate(async () => {
    const response = await fetch("http://127.0.0.1:4096/templates/list")
    const templates = (await response.json()) as Array<{ id: string; agent: string; category: string }>
    return templates.map((template) => `${template.id}:${template.agent}:${template.category}`)
  })

  expect(ids).toContain("project-ppt:ppt_master:ppt")
})
