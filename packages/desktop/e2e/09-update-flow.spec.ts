import { expect, test } from "./helpers/app"

test("更新流程：模拟推送新版本并完成更新", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await page.evaluate(() =>
    window.__TAURI_INVOKE__?.("rw_mock_update_available", { version: "99.0.0", notes: "E2E 测试更新" }),
  )

  await expect(page.locator("[data-testid=update-dialog]")).toBeVisible()
  await expect(page.locator("[data-testid=update-version]")).toContainText("99.0.0")

  await page.locator("[data-testid=update-install-btn]").click()
  await expect(page.locator("[data-testid=update-progress]")).toBeVisible()
})
