import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("工作流画布触发监测报告流水线（端到端）", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=workflow-gallery]"))
  await page.locator("[data-testid=workflow-card-monitor-pipeline]").click()
  await page.locator("[data-testid=workflow-run-btn]").click()

  await expect(page.getByText("workflow-e2e")).toBeVisible()
})
