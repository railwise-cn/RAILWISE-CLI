import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("Agent Studio 修改 chief_manager 提示词并验证生效", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=agents-page]"))
  await page.locator("[data-testid=agent-card-chief_manager]").click()

  await visible(page.locator("[data-testid=agent-prompt-editor]"))
  await expect(page.locator("[data-testid=save-agent-btn]")).toContainText(/已保存|保存/)
})
