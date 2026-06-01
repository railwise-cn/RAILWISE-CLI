import { expect, test } from "./helpers/app"

test("旧项目驾驶舱入口重定向到新工作台", async ({ launchApp }) => {
  const { page } = await launchApp("/dashboard")

  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "告诉 RAILWISE 你想完成什么" })).toBeVisible()
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("告警 Feed")).toHaveCount(0)
  await expect(page.locator("[data-testid=dashboard-map]")).toHaveCount(0)
})
