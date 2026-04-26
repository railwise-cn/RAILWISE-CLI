import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("悟空风格视觉回归：仪表板首屏设计规范检验", async ({ launchApp }, info) => {
  const { page } = await launchApp("/dashboard")

  await visible(page.locator("[data-testid=dashboard-container]"))

  const bg = await page
    .locator("[data-testid=dashboard-container]")
    .evaluate((el) => getComputedStyle(el).backgroundColor)
  expect(bg).toMatch(/rgb\(25[0-2], 25[0-2], 24[7-9]\)/)

  const rust = await page.evaluate(() =>
    Array.from(document.querySelectorAll("*")).some((el) => {
      const style = getComputedStyle(el)
      return [style.color, style.backgroundColor, style.borderColor].some((value) =>
        /rgb\(1[89]\d, [0-5]\d, [0-4]\d\)/.test(value),
      )
    }),
  )
  expect(rust).toBe(false)

  await info.attach("dashboard-visual-regression", {
    body: await page.locator("[data-testid=dashboard-container]").screenshot({ animations: "disabled" }),
    contentType: "image/png",
  })
  await expect(page.locator("[data-testid=dashboard-container]")).toHaveScreenshot("dashboard-visual-regression.png", {
    animations: "disabled",
    maxDiffPixelRatio: 0.02,
  })
})
