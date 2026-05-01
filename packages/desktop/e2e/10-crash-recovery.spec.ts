import { expect, test } from "./helpers/app"
import { state } from "./helpers/wait"

test("崩溃恢复：kill sidecar 后 2s 内自动重启", async ({ launchApp }) => {
  const { page } = await launchApp("/dashboard")

  await state(page.locator("[data-testid=sidecar-status]"), "ready")
  await page.evaluate(() => window.__TAURI_INVOKE__?.("rw_kill_sidecar_for_test"))
  await state(page.locator("[data-testid=sidecar-status]"), "restarting", 1000)
  await state(page.locator("[data-testid=sidecar-status]"), "ready", 2000)
})
