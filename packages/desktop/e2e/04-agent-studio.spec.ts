import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("智能体配置页可编辑 chief_manager 提示词", async ({ launchApp }) => {
  const { page } = await launchApp("/agents/chief_manager")

  await visible(page.locator("[data-testid=agent-prompt-editor]"))
  await expect(page.getByRole("heading", { name: /chief_manager|项目总控/ })).toBeVisible()
  await expect(page.locator("[data-testid=save-agent-btn]")).toContainText(/已保存|保存/)
})
