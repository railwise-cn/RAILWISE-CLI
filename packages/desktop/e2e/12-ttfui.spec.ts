import { expect, test } from "./helpers/app"

test("即开即用：启动到可交互时间 < 3s", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  const start = Date.now()
  await page.reload()
  await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 3000 })
  await expect(page.getByTestId("agents-page")).toBeVisible({ timeout: 3000 })
  await expect(page.locator("[data-testid=sidecar-status]")).toHaveAttribute("data-state", "ready", { timeout: 3000 })

  const ttfui = Date.now() - start
  await page.evaluate((ms) => {
    Object.assign(window, { __RW_PERF__: { ttfui: ms } })
  }, ttfui)
  expect(ttfui).toBeLessThan(3000)
})
