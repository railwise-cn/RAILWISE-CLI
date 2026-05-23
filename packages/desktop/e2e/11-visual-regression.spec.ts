import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("Codex 风格 Harness 工作台首屏视觉验收", async ({ launchApp }, info) => {
  const { page } = await launchApp("/agents")

  await visible(page.getByTestId("agents-page"))

  const bg = await page.getByTestId("agents-page").evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBeTruthy()

  await expect(page.getByText("RAILWISE 智能体 Harness")).toBeVisible()
  await expect(page.getByText("工程任务对话")).toBeVisible()
  await expect(page.getByText("权限、工具和技能由 Harness 在后台编排")).toBeVisible()
  await expect(page.getByTestId("agents-page").locator(".rw-market").getByText("能力市场")).toBeVisible()
  await expect(page.locator(".rw-workspace").getByText("项目文件夹")).toBeVisible()
  await expect(page.locator(".rw-sidebar")).not.toContainText("0 已启用")
  await expect(page.locator("body")).not.toContainText("OpenWork")
  await expect(page.locator("body")).not.toContainText("Build")
  await expect(page.locator("body")).not.toContainText("Explore")

  await info.attach("agents-harness-visual", {
    body: await page.getByTestId("agents-page").screenshot({ animations: "disabled" }),
    contentType: "image/png",
  })
})
