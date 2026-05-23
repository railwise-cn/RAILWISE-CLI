import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("项目文件夹 → 输入任务 → 进入 Harness 会话", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await page.getByTestId("agent-project-directory").fill("/tmp/railwise-e2e")
  await page.getByTestId("agent-collaboration-prompt").fill("检查当前线路复测资料，列出缺失文件和下一步执行计划。")
  await page.getByTestId("agent-start-session").click()

  await expect(page).toHaveURL(/\/session(?:[/?#]|$)/)
  await visible(page.getByTestId("session-harness-panel"))
  await expect(page.getByTestId("session-harness-panel")).toContainText("RAILWISE Harness")
  await expect(page.getByText("@chief_manager")).toBeVisible()
})
