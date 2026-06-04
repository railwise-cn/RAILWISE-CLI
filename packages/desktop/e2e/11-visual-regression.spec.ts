import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧项目驾驶舱入口重定向到极简工作台", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/dashboard", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.getByRole("heading", { name: "想让 RAILWISE 完成什么？" })).toBeVisible()
  await expect(page.locator("[data-testid=home-chat-composer]")).toBeVisible()
  await expect(page.getByText("RAILWISE-CLI").first()).toBeVisible()
  await expect(page.getByText(worktree)).toHaveCount(0)
  await expect(page.getByPlaceholder("输入或粘贴项目路径（可选）")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("告警 Feed")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.locator("[data-testid=dashboard-map]")).toHaveCount(0)
})

test("智能体工作台不再使用旧管理页语言", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page.getByRole("heading", { name: "让 RAILWISE 组织哪项工作？" })).toBeVisible()
  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("#agent-library").getByRole("heading", { name: "智能体库" })).toBeVisible()
  await expect(page.locator("[data-testid=agent-project-directory]")).toHaveCount(0)
  await expect(page.getByText("高级智能体管理")).toHaveCount(0)
  await expect(page.getByText("项目工作区")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
})
