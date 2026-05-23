import { expect, test } from "./helpers/app"

test("离线状态下仍能打开本地 Harness 工作台", async ({ launchApp }) => {
  const { page, context } = await launchApp("/agents")

  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false })
    window.dispatchEvent(new Event("offline"))
  })

  await expect(page.getByTestId("agents-page")).toBeVisible()
  await expect(page.getByText("本地安全模式")).toBeVisible()
  await expect(page.getByText("无待处理")).toBeVisible()

  await context.setOffline(false)
})
