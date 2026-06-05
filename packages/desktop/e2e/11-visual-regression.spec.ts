import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧项目驾驶舱入口进入极简工作台与全局项目栏", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/dashboard", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.getByRole("heading", { name: "RAILWISE" })).toBeVisible()
  await expect(page.locator("[data-testid=home-main-prompt]")).toHaveText("想让 RAILWISE 完成什么？")
  await expect(page.locator("[data-testid=home-chat-composer]")).toBeVisible()
  await expect(page.getByRole("button", { name: "选择项目" })).toBeVisible()
  await expect(page.getByRole("button", { name: /^执行层$/ })).toHaveCount(0)
  await expect(page.locator("[data-testid=home-harness-panel]").getByRole("button", { name: /^能力市场$/ })).toBeVisible()
  await expect(page.locator("[data-testid=home-harness-panel]")).toContainText("连接：")
  await expect(page.locator("[data-testid=home-harness-panel]")).toContainText("模型：")
  await expect(page.locator("[data-testid=home-harness-panel]")).not.toContainText("执行环境：")
  await expect(page.locator("[data-testid=home-harness-panel]")).toContainText("能力市场")
  await expect(page.locator("[data-testid=home-project-rail]")).toBeVisible()
  await expect(page.locator("[data-testid=home-project-summary]")).toContainText("项目")
  await expect(page.locator("[data-testid=home-session-rail]")).toContainText("会话")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("执行")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("服务")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("任务")
  await expect(page.locator("[data-testid=home-runtime-rail]")).not.toContainText("智能体、工具、流程统一安装。")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.getByText("选择文件夹后会出现在这里。")).toHaveCount(0)
  await expect(page.getByText("选择文件夹", { exact: true })).toHaveCount(0)
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
  await expect(page.getByRole("heading", { name: "RAILWISE 协作" })).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.locator("[data-testid=agent-marketplace]")).toBeVisible()
  await expect(page.locator("#agent-library").getByRole("heading", { name: "智能体" })).toBeVisible()
  await expect(page.locator(".agent-command-sidebar")).toHaveCount(0)
  await expect(page.locator("[data-testid=agent-project-directory]")).toHaveCount(0)
  await expect(page.getByText("选择文件夹后会出现在这里。")).toHaveCount(0)
  await expect(page.getByText("高级智能体管理")).toHaveCount(0)
  await expect(page.getByText("智能体矩阵")).toHaveCount(0)
  await expect(page.getByText("项目驾驶舱")).toHaveCount(0)
  await expect(page.getByText("多智能体协作中枢")).toHaveCount(0)
})

test("项目侧栏提供清晰会话入口并隐藏工作区后台标签", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/empty-project"
  const { page } = await launchApp("/home", {
    emptySessions: true,
    projects: [{ id: "empty-project", worktree, vcs: "git", time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  const sidebar = page.locator("[data-component=sidebar-nav-desktop]")
  await expect(sidebar).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(sidebar).not.toContainText(worktree)
  await expect(sidebar).toContainText("还没有会话")
  await expect(sidebar).toContainText("从新建会话开始协作。")

  await sidebar.locator("[data-action=project-menu]").last().click()
  await page.getByText("启用工作区").click()

  const workspace = page.locator("[data-component=workspace-item]").first()
  await expect(workspace).toContainText("主工作区")
  await expect(workspace).not.toContainText("本地 :")
  await expect(workspace).not.toContainText("沙盒 :")
  await expect(sidebar).not.toContainText(worktree)
})

test("首页右侧项目栏显示最近会话与执行状态", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    projects: [{ id: "railwise-e2e", worktree, vcs: "git", time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.locator("[data-testid=home-project-summary]")).toContainText("worktree")
  await expect(page.locator("[data-testid=home-session-rail]")).toContainText("复测资料检查")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("1 个任务运行中")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("1 项待确认")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("模型已接入")
  await expect(page.locator("[data-testid=home-project-rail]")).not.toContainText(worktree)
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

test("文件工作区使用统一项目侧栏", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/workspace/diff", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=workspace-diff-container]"))
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByRole("heading", { name: "版本对比" })).toBeVisible()
  await expect(page.locator("[data-testid=workspace-diff-container]")).not.toContainText("/workspace/diff")
})
