import { expect, test } from "./helpers/app"

test("qa_inspector 数据首检 → 生成报告", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/workspace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
    workspaceFiles: [{ path: "/tmp/monitor-data.csv", kind: "csv" }],
  })

  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await page.locator("[data-testid=workspace-file-item]").first().click()
  await page.locator("[data-testid=send-to-agent-btn]").click()

  await expect(page.getByText("已发送到 Agent 队列。")).toBeVisible()
})
