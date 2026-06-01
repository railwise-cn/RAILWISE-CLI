import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("能力市场保持极简能力包入口", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("[data-testid=marketplace-card-state-agents]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-card-state-tools]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-card-state-skills]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-card-state-providers]")).toContainText("待接入")
  await expect(page.locator("[data-testid=marketplace-preview-agents]")).toContainText("chief_manager")
  await page.getByRole("button", { name: "Tools" }).click()
  await expect(page.locator("[data-testid=marketplace-state-tools]")).toContainText("已启用")
  await expect(page.locator("[data-testid=marketplace-preview-tools]")).toContainText("规范条文查询")
  await page.getByRole("button", { name: "Skills" }).click()
  await expect(page.locator("[data-testid=marketplace-preview-skills]")).toContainText("monitoring-design")
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-model-routing]")).toHaveCount(0)
})

test("高级智能体管理作为独立路由打开", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page).toHaveURL(/\/agents$/)
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toBeVisible()
  await expect(page.locator("[data-testid=agent-model-routing]")).toBeVisible()
})

test("能力市场进入 chief_manager 高级配置并验证保存入口", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await page.locator("[data-testid=marketplace-open-agents]").click()
  await visible(page.locator("[data-testid=agents-page]"))
  await page.locator("[data-testid=agent-card-chief_manager]").click()

  await visible(page.locator("[data-testid=agent-prompt-editor]"))
  await expect(page.locator("[data-testid=save-agent-btn]")).toContainText(/已保存|保存/)
})

test("能力市场可以进入 Harness 执行层状态", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await page.getByRole("button", { name: "Harness" }).click()
  await page.getByRole("link", { name: "查看 Harness" }).click()

  await visible(page.locator("[data-testid=harness-page]"))
  await expect(page).toHaveURL(/\/harness$/)
  await expect(page.getByRole("heading", { name: "执行层状态" })).toBeVisible()
})

test("Harness 可以作为桌面独立路由打开", async ({ launchApp }) => {
  const { page } = await launchApp("/harness")

  await visible(page.locator("[data-testid=harness-page]"))
  await expect(page.getByRole("heading", { name: "执行层状态" })).toBeVisible()
  await expect(page.locator("[data-testid=harness-permissions]")).toContainText("当前没有等待审批的动作")
  await expect(page.locator("[data-testid=harness-timeline]")).toContainText("还没有会话执行记录")
  await expect(page.locator("[data-testid=harness-session-detail]")).toContainText("还没有可查看的会话")
})
