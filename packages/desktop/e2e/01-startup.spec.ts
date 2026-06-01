import { expect, test } from "./helpers/app"
import { state } from "./helpers/wait"

test("启动后 sidecar 在 15s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp("/home")

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "告诉 RAILWISE 你想完成什么" })).toBeVisible()
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
})
