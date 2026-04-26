import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("创建项目 → 导入 CSV → 数据预览", async ({ launchApp }) => {
  const { page } = await launchApp("/workspace", {
    workspaceFiles: [{ path: "/tmp/monitor-data.csv", kind: "csv" }],
  })

  await page.locator("[data-testid=workspace-file-item]").first().click()
  await visible(page.locator("[data-testid=csv-preview-table]"))
  await expect(page.locator(".workspace-row")).toHaveCount(2)
})
