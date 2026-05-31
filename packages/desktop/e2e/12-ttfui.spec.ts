import { expect, test } from "./helpers/app"

test("即开即用：启动到可交互时间 < 15s", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  const start = Date.now()
  await page.reload()
  await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 15000 })
  await expect(page.locator("[data-testid=agents-page]")).toBeVisible({ timeout: 15000 })
  await expect(page.locator("[data-testid=sidecar-status]")).toHaveAttribute("data-state", "ready", { timeout: 15000 })

  const ttfui = Date.now() - start
  await page.evaluate((ms) => {
    Object.assign(window, { __RW_PERF__: { ttfui: ms } })
  }, ttfui)
  expect(ttfui).toBeLessThan(15000)
})
