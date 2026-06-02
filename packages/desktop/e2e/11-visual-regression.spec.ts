import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧项目驾驶舱入口重定向到极简工作台", async ({ launchApp }) => {
  const { page } = await launchApp("/dashboard")

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.getByRole("heading", { name: "想让 RAILWISE 完成什么？" })).toBeVisible()
  await expect(page.locator("[data-testid=home-chat-composer]")).toBeVisible()
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("告警 Feed")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.locator("[data-testid=dashboard-map]")).toHaveCount(0)
})
