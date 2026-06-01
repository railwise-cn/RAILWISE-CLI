import { expect, test } from "./helpers/app"

test("离线模式：智能体中枢保持本地入口可用", async ({ launchApp }) => {
  const { page, context } = await launchApp("/agents")
  await expect(page.locator("[data-testid=agents-page]")).toBeVisible()

  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false })
    window.dispatchEvent(new Event("offline"))
  })

  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await page.getByRole("button", { name: "Skills" }).click()
  await expect(page.locator("[data-testid=agent-market-panel]")).toContainText("专业流程")
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toBeVisible()
  await expect(page.locator("[data-testid=agent-model-routing]")).toBeVisible()

  await context.setOffline(false)
})
