import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧 agents 路由重定向到能力市场", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page).toHaveURL(/\/marketplace$/)
})

test("能力市场进入 chief_manager 高级配置并验证保存入口", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=agents-page]"))
  await page.locator("[data-testid=agent-card-chief_manager]").click()

  await visible(page.locator("[data-testid=agent-prompt-editor]"))
  await expect(page.locator("[data-testid=save-agent-btn]")).toContainText(/已保存|保存/)
})
