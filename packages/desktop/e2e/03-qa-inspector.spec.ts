import { expect, test } from "./helpers/app"

test("能力市场启用模型 Provider 并更新 Harness 计数", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await page.getByTestId("market-filter-provider").click()
  await expect(page.getByTestId("market-capability-railwise.provider.deepseek")).toContainText("DeepSeek")
  await expect(page.getByTestId("market-capability-railwise.provider.deepseek")).toContainText("可启用")

  await page.getByTestId("market-capability-toggle-railwise.provider.deepseek").click()
  await expect(page.getByTestId("market-capability-railwise.provider.deepseek")).toContainText("已启用")
  await expect(page.getByText("7 已启用")).toBeVisible()
})
