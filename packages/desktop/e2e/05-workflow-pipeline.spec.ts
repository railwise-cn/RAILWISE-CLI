import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("工作流画布触发 CPIII 交付验收与交付包导出（端到端）", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=workflow-gallery]"))
  await page.locator("[data-testid=workflow-card-cpiii-resurvey-wiki]").click()
  await expect(page.locator("[data-testid=workflow-wiki-status]")).toBeVisible()
  await expect(page.locator("[data-testid=workflow-format-report]")).toContainText("格式样本覆盖")
  await page.locator("[data-testid=workflow-run-btn]").click()

  await expect(page).toHaveURL(/\/session\/workflow-e2e(?:[/?#]|$)/)
  await visible(page.locator("[data-testid=workflow-acceptance-panel]"))

  const action = page.locator("[data-testid=workflow-acceptance-btn]")
  await expect(action).toContainText("交付验收")
  await action.click()

  await expect(page.locator("[data-testid=workflow-acceptance-result]")).toContainText("附件引用")
  await expect(action).toContainText("导出摘要")
  await action.click()

  await expect(page.locator("[data-testid=workflow-delivery-archive]")).toContainText("完整 · 3 个文件")
  await expect(page.locator("[data-testid=workflow-delivery-file-list]")).toContainText("交付清单 JSON")
  await expect(page.locator("[data-testid=workflow-delivery-file-list]")).toContainText("格式样本覆盖")
})
