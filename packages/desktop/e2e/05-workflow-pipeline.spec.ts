import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("工具与 Skills 面板展示专业工程能力", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.getByTestId("agents-page"))
  await expect(page.getByTestId("agent-tool-item")).toHaveCount(3)
  await expect(page.getByTestId("agent-skill-item")).toHaveCount(3)
  await expect(page.getByTestId("agent-tool-item").filter({ hasText: "间接平差计算" })).toBeVisible()
  await expect(page.getByTestId("agent-tool-item").filter({ hasText: "规范 Wiki 查询" })).toBeVisible()
  await expect(page.getByTestId("agent-skill-item").filter({ hasText: "监测方案设计" })).toBeVisible()
  await expect(page.getByTestId("agent-skill-item").filter({ hasText: "测绘数据平差与变形分析" })).toBeVisible()
})
