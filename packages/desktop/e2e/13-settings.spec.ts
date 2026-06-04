import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("设置中心：MCP、智能体、命令页展示真实数据", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await page.getByLabel(/设置|Settings/).first().click()

  await page.getByRole("tab", { name: /MCP/ }).click()
  const mcp = page.getByRole("tabpanel", { name: /MCP/ })
  await expect(mcp.getByText(/railwise_inspector/)).toBeVisible()
  await expect(mcp.getByText(/report_exporter/)).toBeVisible()

  await page.getByRole("tab", { name: /智能体|Agents/ }).click()
  const agents = page.getByRole("tabpanel", { name: /智能体|Agents/ })
  await expect(agents.getByText(/chief_manager/)).toBeVisible()
  await expect(agents.getByText(/qa_inspector/)).toBeVisible()
  await expect(agents.locator("[data-testid=settings-agents-panel]")).toContainText(/智能体能力配置|Agent capability configuration/)
  await expect(agents.getByRole("button", { name: /打开智能体工作台|Open Agent Studio/ })).toBeVisible()
  await expect(agents.getByRole("button", { name: /配置|Configure/ }).first()).toBeVisible()
  await expect(agents.getByText(/高级管理/)).toHaveCount(0)

  await page.getByRole("tab", { name: /命令|Commands/ }).click()
  const commands = page.getByRole("tabpanel", { name: /命令|Commands/ })
  await expect(commands.getByText(/quality-report/)).toBeVisible()
  await expect(commands.getByText(/工程 Slash 命令|Project slash commands/)).toBeVisible()
})
