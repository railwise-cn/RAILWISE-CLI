import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("DXF 打开并切换图层", async ({ launchApp }) => {
  const { page } = await launchApp("/workspace", {
    workspaceFiles: [{ path: "/tmp/sample-survey.dxf", kind: "dxf" }],
  })

  await page.locator("[data-testid=workspace-file-item]").first().click()
  await visible(page.locator("[data-testid=dxf-canvas]"))
  await expect(page.locator("[data-testid=layer-item]")).toHaveCount(2)

  await page.locator("[data-testid=layer-toggle]").first().click()
  await expect(page.locator("[data-testid=layer-item]").first()).toHaveAttribute("data-visible", "false")
})
