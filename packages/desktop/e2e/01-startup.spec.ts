import { expect, test } from "./helpers/app"
import { state, visible } from "./helpers/wait"

test("启动后 sidecar 在 15s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp()

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.locator("[data-testid=home-workbench]")).toBeVisible()
})

test("首页任务输入直接进入 chief_manager 协作会话", async ({ launchApp }) => {
  const { page } = await launchApp()

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await page.locator("[data-testid=home-project-directory]").fill("/tmp/railwise-e2e/worktree")
  await page.locator("[data-testid=home-task-input]").fill("检查当前线路复测资料，列出缺失文件并给出下一步计划。")
  await page.locator("[data-testid=home-start-session]").click()

  await expect(page).toHaveURL(/\/session$/)
  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("chief_manager")
  await expect(page.locator("[data-testid=session-model-readiness]")).toContainText("发送前先接入模型")
  await expect(page.locator("[data-testid=session-model-setup]")).toContainText("接入模型")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("@chief_manager")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("检查当前线路复测资料")
})
