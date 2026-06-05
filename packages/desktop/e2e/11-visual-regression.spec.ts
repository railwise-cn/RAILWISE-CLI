import { expect, test } from "./helpers/app"
import { visible } from "./helpers/wait"

test("旧首页入口进入极简工作台与全局项目栏", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/dashboard", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await expect(page).toHaveURL(/\/home$/)
  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.getByRole("heading", { name: "RAILWISE" })).toBeVisible()
  await expect(page.locator("[data-testid=home-main-prompt]")).toHaveText("想让 RAILWISE 完成什么？")
  await expect(page.locator("[data-testid=home-chat-composer]")).toBeVisible()
  await expect(page.locator("[data-testid=home-chat-composer]").getByRole("button", { name: "打开项目" })).toBeVisible()
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
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
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

test("能力配置不再使用旧管理页语言", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/agents", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=agents-page]"))
  await expect(page.getByRole("heading", { name: "RAILWISE 协作" })).toBeVisible()
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
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
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
  await expect(sidebar).not.toContainText(worktree)
  await expect(sidebar).toContainText("还没有会话")
  await expect(sidebar).toContainText("从新建会话开始协作。")
  await expect(page.locator("[data-testid=home-empty-sessions]")).toContainText("输入任务会创建第一条会话。")
  await expect(page.locator("[data-testid=home-empty-sessions]").getByRole("button", { name: "新建会话" })).toBeVisible()

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
  const sibling = "/tmp/other-client/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    projects: [
      { id: "railwise-e2e", worktree, vcs: "git", time: { created: Date.now(), updated: Date.now() } },
      { id: "other-client", worktree: sibling, vcs: "git", time: { created: Date.now() - 10_000, updated: Date.now() - 10_000 } },
    ],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  await expect(page.locator("[data-testid=home-project-summary]")).toContainText("worktree (railwise-e2e)")
  await expect(page.locator("[data-testid=home-recent-projects]")).toContainText("worktree (other-client)")
  await expect(page.locator("[data-testid=home-session-rail]")).toContainText("运营期监测预警复核")
  await expect(page.locator("[data-testid=home-resume-session]")).toHaveText("继续")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("1 个任务运行中")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("1 项待确认")
  await expect(page.locator("[data-testid=home-runtime-rail]")).toContainText("模型已接入")
  await expect(page.locator("[data-testid=home-capability-rail]")).toContainText("快捷入口")
  await expect(page.locator("[data-testid=home-capability-rail]")).toContainText("智能体")
  await expect(page.locator("[data-testid=home-capability-rail]")).toContainText("执行中心")
  await expect(page.locator("[data-testid=home-capability-rail]")).toContainText("能力市场")
  await expect(page.locator("[data-testid=home-agent-capability-preview]")).toContainText("默认能力")
  await expect(page.locator("[data-testid=home-capability-rail]")).toContainText("轨道交通监测方案")
  await expect(page.locator("[data-testid=home-project-rail]")).not.toContainText(worktree)
  await expect(page.locator("[data-testid=home-project-rail]")).not.toContainText(sibling)
})

test("左侧空项目栏提供明确入口而不是空白面板", async ({ launchApp }) => {
  const { page } = await launchApp("/home", {
    emptySessions: true,
    projects: [],
  })

  await visible(page.locator("[data-testid=home-workbench]"))
  const sidebar = page.locator("[data-component=sidebar-nav-desktop]")
  const empty = sidebar.locator("[data-testid=sidebar-empty-project]")
  await expect(sidebar).toBeVisible()
  await expect(empty).toBeVisible()
  await expect(empty).toContainText("打开项目开始协作")
  await expect(empty.getByRole("button", { name: "打开项目" })).toBeVisible()
  await expect(empty).toContainText("能力市场")
  await expect(empty).toContainText("设置")
  await expect(page.locator("[data-testid=home-empty-sessions]")).toContainText("先打开项目，再开始协作。")
  await expect(page.locator("[data-testid=home-empty-sessions]").getByRole("button", { name: "打开项目" })).toBeVisible()
  await expect(sidebar).not.toContainText("/tmp/railwise-e2e")
  await expect(sidebar).not.toContainText("选择文件夹后会出现在这里。")
})

test("智能体详情不再使用后台编辑语言", async ({ launchApp }) => {
  const { page } = await launchApp("/agents/chief_manager")

  await visible(page.locator("[data-testid=agent-detail-page]"))
  await expect(page.locator("[data-testid=agent-detail-shell]")).toContainText("智能体配置")
  await expect(page.getByRole("heading", { name: "能力定义" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "预览" })).toBeVisible()
  await expect(page.locator("[data-testid=agent-capability-routing]")).toContainText("可调用能力")
  await expect(page.locator("[data-testid=agent-capability-routing]")).toContainText("规范条文速查")
  await expect(page.getByText("Markdown 配置")).toHaveCount(0)
  await expect(page.getByText("高级管理")).toHaveCount(0)
  await expect(page.getByText("高级")).toHaveCount(0)
})

test("能力市场与执行中心不再使用后台管理语言", async ({ launchApp }) => {
  const worktree = "/Users/WANGJIAWEI/CODE/RAILWISE-CLI"
  const { page } = await launchApp("/marketplace", {
    projects: [{ id: "railwise-cli", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await visible(page.locator("[data-testid=marketplace-page]"))
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByText("进入高级管理")).toHaveCount(0)

  await page.goto("/harness")
  await visible(page.locator("[data-testid=harness-page]"))
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).toBeVisible()
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByRole("heading", { name: "执行中心" })).toBeVisible()
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
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("本地项目")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText(worktree)
  await expect(page.getByRole("heading", { name: "版本对比" })).toBeVisible()
  await expect(page.locator("[data-testid=workspace-diff-container]")).not.toContainText("/workspace/diff")
})
