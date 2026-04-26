import { expect, test } from "./helpers/app"
import { state } from "./helpers/wait"

test("启动后 sidecar 在 3s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp("/dashboard")

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 3000)
})
