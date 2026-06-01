import { expect, test } from "./helpers/app"
import { state } from "./helpers/wait"

test("启动后 sidecar 在 15s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp("/home")

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.locator("[data-testid=home-workbench]")).toBeVisible()
})
