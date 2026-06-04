import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("创建项目 → 导入 CSV → 数据预览", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/workspace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
    workspaceFiles: [{ path: "/tmp/monitor-data.csv", kind: "csv" }],
  })

  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.locator("[data-testid=workspace-container]")).not.toContainText("/workspace")
  await page.locator("[data-testid=workspace-file-item]").first().click()
  await visible(page.locator("[data-testid=csv-preview-table]"))
  await expect(page.locator("[data-testid=workspace-container]")).not.toContainText("/tmp/monitor-data.csv")
  await expect(page.locator(".workspace-row")).toHaveCount(2)
})
