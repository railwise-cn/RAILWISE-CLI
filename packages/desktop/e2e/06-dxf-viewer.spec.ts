import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("能力市场可按智能体和工作流分类浏览", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.getByTestId("agents-page"))
  await page.getByTestId("market-filter-agent").click()
  await expect(page.getByTestId("market-capability-railwise.agent.chief_manager")).toContainText("项目总控")
  await expect(page.getByTestId("market-capability-railwise.agent.cpiii_specialist")).toContainText("CPIII 测量专家")

  await page.getByTestId("market-filter-workflow").click()
  await expect(page.getByTestId("market-capability-railwise.workflow.survey_package_review")).toContainText(
    "复测资料完整性检查",
  )
})
