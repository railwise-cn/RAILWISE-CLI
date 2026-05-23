import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("Codex 风格 Harness 工作台首屏视觉验收", async ({ launchApp }, info) => {
  const { page } = await launchApp("/agents")

  await visible(page.getByTestId("agents-page"))

  const bg = await page.getByTestId("agents-page").evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toBeTruthy()

  await expect(page.getByText("把工程任务交给 RAILWISE")).toBeVisible()
  await expect(page.getByText("说清目标，其余交给后台编排")).toBeVisible()
  await expect(page.getByText("权限请求会在会话中确认。")).toBeVisible()
  await expect(page.getByTestId("agent-harness-plan").getByText("执行预览")).toBeVisible()
  await expect(page.getByTestId("agent-harness-plan").getByText("输入任务后自动细化")).toBeVisible()
  await expect(page.getByTestId("agents-page").locator(".rw-market").getByText("能力市场")).toBeVisible()
  await expect(page.locator(".rw-market-grid")).toBeHidden()
  await expect(page.locator(".rw-agent-list").getByText("默认自动选择专业能力")).toBeVisible()
  await expect(page.locator(".rw-workspace").getByText("项目文件夹")).toBeVisible()
  await expect(page.locator(".rw-sidebar")).not.toContainText("0 已启用")
  await expect(page.locator("body")).not.toContainText("OpenWork")
  await expect(page.locator("body")).not.toContainText("Build")
  await expect(page.locator("body")).not.toContainText("Explore")

  await info.attach("agents-harness-first-screen", {
    body: await page.getByTestId("agents-page").screenshot({ animations: "disabled" }),
    contentType: "image/png",
  })

  await page.locator(".rw-nav-actions").getByRole("button", { name: "能力市场" }).click()
  await expect(page.getByTestId("market-filter-all")).toBeVisible()
  await expect(page.getByTestId("market-capability-railwise.agent.chief_manager")).toContainText("项目总控")
  await page.locator(".rw-nav-actions").getByRole("button", { name: "高级配置" }).click()
  await expect(page.locator(".rw-agent-list").getByText("chief_manager")).toBeVisible()
})
