import { expect, test } from "./helpers/app"

test("qa_inspector 数据首检 → 生成报告", async ({ launchApp }) => {
  const { page } = await launchApp("/workspace", {
    workspaceFiles: [{ path: "/tmp/monitor-data.csv", kind: "csv" }],
  })

  await page.locator("[data-testid=workspace-file-item]").first().click()
  await page.locator("[data-testid=send-to-agent-btn]").click()

  await expect(page.getByText("已发送到 Agent 队列。")).toBeVisible()
})
