import { expect, test } from "./helpers/app"

test("离线模式：地图降级 + 本地 LLM 切换", async ({ launchApp }) => {
  const { page, context } = await launchApp("/dashboard")
  await expect(page.locator("[data-testid=dashboard-map]")).toBeVisible()

  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false })
    window.dispatchEvent(new Event("offline"))
  })

  await expect(page.locator("[data-testid=map-offline-indicator]")).toBeVisible()
  await expect(page.locator("[data-testid=map-tile-source]")).toContainText("本地缓存")

  await context.setOffline(false)
})
