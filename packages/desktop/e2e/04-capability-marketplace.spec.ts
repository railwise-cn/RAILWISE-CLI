import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("能力市场展示可安装能力并保持配置入口独立", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await expect(page.getByRole("heading", { name: "能力市场" })).toBeVisible()
  await expect(page.getByRole("link", { name: "返回工作台" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Harness" })).toBeVisible()
  await expect(page.getByRole("button", { name: "智能体" })).toBeVisible()
  await expect(page.getByRole("button", { name: "工具" })).toBeVisible()
  await expect(page.getByRole("button", { name: "模型" })).toBeVisible()
  await expect(page.getByText("RAILWISE 默认协作")).toBeVisible()
  await expect(page.getByText("本地文件读取")).toBeVisible()
  await expect(page.getByText("复测资料检查")).toBeVisible()
  await expect(page.getByText("DeepSeek")).toBeVisible()
  await expect(page.getByText("文件读取").first()).toBeVisible()
  await expect(page.getByText("密钥访问")).toBeVisible()
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-model-routing]")).toHaveCount(0)
})

test("高级智能体管理作为独立路由打开", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page).toHaveURL(/\/agents$/)
  await expect(page.locator("[data-testid=agent-collaboration-start]")).toBeVisible()
  await expect(page.locator("[data-testid=agent-model-routing]")).toBeVisible()
  await expect(page.getByRole("heading", { name: "上下文文件夹" })).toBeVisible()
  await expect(page.locator("#agent-library").getByRole("heading", { name: "智能体库" })).toBeVisible()
  await expect(page.getByText("项目工作区")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
})

test("能力市场可以进入执行层状态", async ({ launchApp }) => {
  const { page } = await launchApp("/marketplace")

  await visible(page.locator("[data-testid=marketplace-page]"))
  await page.getByRole("link", { name: "Harness" }).click()

  await visible(page.locator("[data-testid=harness-page]"))
  await expect(page).toHaveURL(/\/harness$/)
  await expect(page.getByRole("heading", { name: "运行时控制台" })).toBeVisible()
})
