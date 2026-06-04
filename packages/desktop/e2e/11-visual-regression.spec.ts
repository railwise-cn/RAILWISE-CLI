import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧项目驾驶舱入口进入极简工作台与全局项目栏", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/dashboard", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.getByRole("heading", { name: "想让 RAILWISE 完成什么？" })).toBeVisible()
  await expect(page.locator("[data-testid=home-chat-composer]")).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.getByText("选择文件夹后会出现在这里。")).toHaveCount(0)
  await expect(page.getByText("RAILWISE-CLI").first()).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByText(worktree)).toHaveCount(0)
  await expect(page.getByPlaceholder("输入或粘贴项目路径（可选）")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("告警 Feed")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.locator("[data-testid=dashboard-map]")).toHaveCount(0)
})

test("智能体工作台不再使用旧管理页语言", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/agents", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page.getByRole("heading", { name: "让 RAILWISE 组织哪项工作？" })).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("#agent-library").getByRole("heading", { name: "智能体库" })).toBeVisible()
  await expect(page.locator(".agent-command-sidebar")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-project-directory]")).toHaveCount(0)
  await expect(page.getByText("选择文件夹后会出现在这里。")).toHaveCount(0)
  await expect(page.getByText("高级智能体管理")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
})

test("智能体详情不再使用后台编辑语言", async ({ launchApp }) => {
  const { page } = await launchApp("/agents/chief_manager")

  await visible(page.locator("[data-testid=agent-detail-page]"))
  await expect(page.locator("[data-testid=agent-detail-shell]")).toContainText("智能体配置")
  await expect(page.getByRole("heading", { name: "能力定义" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "预览" })).toBeVisible()
  await expect(page.getByText("Markdown 配置")).toHaveCount(0)
  await expect(page.getByText("高级管理")).toHaveCount(0)
  await expect(page.getByText("高级")).toHaveCount(0)
})

test("能力市场与执行层不再使用后台管理语言", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/marketplace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=marketplace-page]"))
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByText("进入高级管理")).toHaveCount(0)

  await page.goto("/harness")
  await visible(page.locator("[data-testid=harness-page]"))
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByRole("heading", { name: "执行控制台" })).toBeVisible()
  await expect(page.locator("[data-testid=harness-shell]")).toBeVisible()
  await expect(page.getByText("执行层状态")).toHaveCount(0)
})
