import { expect, test } from "./helpers/app"

test("离线模式：能力市场保持本地入口可用", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page, context } = await launchApp("/marketplace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })
  await expect(page.locator("[data-testid=marketplace-page]")).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.locator("[data-testid=marketplace-permissions-agents]")).toContainText("RAILWISE 主控")

  await context.setOffline(true)
  await page.evaluate(() => {
    Object.defineProperty(Navigator.prototype, "onLine", { configurable: true, get: () => false })
    window.dispatchEvent(new Event("offline"))
  })

  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("[data-testid=marketplace-row-state-agents]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-row-state-tools]")).toContainText("已启用")
  await page.getByRole("button", { name: "流程" }).click()
  await expect(page.locator("[data-testid=agent-market-panel]")).toContainText("专业流程")
  await expect(page.locator("[data-testid=marketplace-state-skills]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-preview-skills]")).toContainText("monitoring-design")
  await expect(page.locator("[data-testid=marketplace-permissions-skills]")).toContainText("复测资料检查")
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-model-routing]")).toHaveCount(0)
  await expect(page.locator("[data-testid=marketplace-row-agents]")).toBeVisible()

  await context.setOffline(false)
})
