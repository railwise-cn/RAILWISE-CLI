import { expect, test } from "./helpers/app"

test("离线模式：能力市场保持本地入口可用", async ({ launchApp }) => {
  const { page, context } = await launchApp("/marketplace")
  await expect(page.locator("[data-testid=marketplace-page]")).toBeVisible()

  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false })
    window.dispatchEvent(new Event("offline"))
  })

  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("[data-testid=marketplace-row-state-agents]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-row-state-tools]")).toContainText("已启用")
  await page.locator("[data-testid=marketplace-row-skills]").click()
  await expect(page.locator("[data-testid=agent-market-panel]")).toContainText("Skills 专业技能")
  await expect(page.locator("[data-testid=marketplace-state-skills]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-preview-skills]")).toContainText("monitoring-design")
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-model-routing]")).toHaveCount(0)
  await expect(page.locator("[data-testid=marketplace-row-agents]")).toBeVisible()

  await context.setOffline(false)
})
