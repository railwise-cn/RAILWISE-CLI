import { expect, test } from "./helpers/app"

test("即开即用：启动到可交互时间 < 15s", async ({ launchApp }) => {
  const { page } = await launchApp("/home")

  const start = Date.now()
  await page.reload()
  await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 15000 })
  await expect(page.locator("[data-testid=workbench-page]")).toBeVisible({ timeout: 15000 })
  await expect(page.getByRole("heading", { name: "告诉 RAILWISE 你想完成什么" })).toBeVisible({ timeout: 15000 })
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
  await expect(page.locator("[data-testid=sidecar-status]")).toHaveAttribute("data-state", "ready", { timeout: 15000 })

  const ttfui = Date.now() - start
  await page.evaluate((ms) => {
    Object.assign(window, { __RW_PERF__: { ttfui: ms } })
  }, ttfui)
  expect(ttfui).toBeLessThan(15000)
})
