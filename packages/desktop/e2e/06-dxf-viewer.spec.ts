import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("DXF 打开并切换图层", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/workspace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
    workspaceFiles: [{ path: "/tmp/sample-survey.dxf", kind: "dxf" }],
  })

  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await page.locator("[data-testid=workspace-file-item]").first().click()
  await visible(page.locator("[data-testid=dxf-canvas]"))
  await expect(page.locator("[data-testid=layer-item]")).toHaveCount(2)

  await page.locator("[data-testid=layer-toggle]").first().click()
  await expect(page.locator("[data-testid=layer-item]").first()).toHaveAttribute("data-visible", "false")
})
