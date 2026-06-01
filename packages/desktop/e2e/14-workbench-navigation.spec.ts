import { expect, test } from "./helpers/app"

test("Workbench 首屏可进入能力市场和 Harness", async ({ launchApp }) => {
  const { page } = await launchApp("/home")

  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await page.getByRole("link", { name: "能力市场" }).click()
  await expect(page.getByTestId("marketplace-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "能力市场" })).toBeVisible()
  await expect(page.getByText("项目总控")).toBeVisible()
  await expect(page.getByText("DeepSeek")).toBeVisible()

  await page.getByRole("link", { name: "返回工作台" }).click()
  await expect(page.getByTestId("workbench-page")).toBeVisible()

  await page.getByRole("link", { name: "Harness" }).click()
  await expect(page.getByTestId("harness-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "运行时控制台" })).toBeVisible()
  await expect(page.getByText("本地安全模式")).toBeVisible()
  await expect(page.getByText("5 项已启用")).toBeVisible()
})
