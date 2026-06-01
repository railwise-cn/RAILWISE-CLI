import { test, expect } from "../fixtures"

test("home renders the Workbench entrypoints", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "告诉 RAILWISE 你想完成什么" })).toBeVisible()
  await expect(page.getByRole("button", { name: "选择资料目录" })).toBeVisible()
  await expect(page.getByRole("link", { name: "能力市场" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Harness" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open project" })).toHaveCount(0)
})

test("Workbench navigation opens capability pages", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("link", { name: "能力市场" }).click()
  await expect(page.getByTestId("marketplace-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "能力市场" })).toBeVisible()

  await page.getByRole("link", { name: "返回工作台" }).click()
  await expect(page.getByTestId("workbench-page")).toBeVisible()

  await page.getByRole("link", { name: "Harness" }).click()
  await expect(page.getByTestId("harness-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "运行时控制台" })).toBeVisible()
})
