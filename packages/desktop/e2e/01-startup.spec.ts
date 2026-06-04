import { expect, test } from "./helpers/app"
import { state, visible } from "./helpers/wait"

test("启动后 sidecar 在 15s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp()

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.locator("[data-testid=home-workbench]")).toBeVisible()
})

test("普通浏览器预览不会因为缺少 Tauri internals 白屏", async ({ page }) => {
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))

  await page.goto("/home")
  await expect(page.locator("[data-testid=app-shell]")).toBeVisible({ timeout: 30_000 })
  await expect(page.locator("[data-testid=home-workbench]")).toContainText("RAILWISE")
  await expect(
    page.evaluate(
      () =>
        (window as Window & { __RAILWISE__?: { browserHarness?: boolean } }).__RAILWISE__?.browserHarness === true,
    ),
  ).resolves.toBe(true)
  expect(errors).toEqual([])
})

test("首页任务输入直接进入 chief_manager 协作会话", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
  await expect(page.locator("[data-testid=home-project-directory]")).toContainText("worktree")
  await page.locator("[data-testid=home-task-input]").fill("检查当前线路复测资料，列出缺失文件并给出下一步计划。")
  await page.locator("[data-testid=home-start-session]").click()

  await expect(page).toHaveURL(/\/session$/)
  const card = page.locator("[data-testid=session-new-project-card]")
  await visible(card, 15000)
  expect(
    await card.evaluate((node) => {
      const box = node.getBoundingClientRect()
      return document.elementsFromPoint(box.x + 24, box.y + 24).some((item) => item === node || node.contains(item))
    }),
  ).toBe(true)
  await expect(page.locator("[data-testid=session-new-project-name]")).toHaveText("worktree")
  await expect(card).not.toContainText("/tmp/railwise-e2e")
  await visible(page.locator("[data-testid=session-status-panel]"), 15000)
  await expect(page.locator("[data-testid=session-status-project]")).toHaveText("worktree")
  await expect(page.locator("[data-testid=session-status-agent]")).toHaveText("RAILWISE")
  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("RAILWISE")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("模型")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("模板")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("能力")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("业务模板")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("默认建议")
  await expect(page.locator("[data-testid=session-status-panel]")).toContainText("状态")
  await expect(page.locator("[data-testid=session-runtime-panel]")).toContainText("执行")
  await expect(page.locator("[data-testid=session-status-panel]")).not.toContainText("环境")
  await expect(page.locator("[data-testid=session-status-panel]")).not.toContainText("会话状态")
  await expect(page.locator("[data-testid=sidebar-project-meta]").first()).toHaveText("项目工作区")
  await expect(page.locator("[data-component=sidebar-nav-desktop]")).not.toContainText("/tmp/railwise-e2e")
  await expect(page.locator("[data-testid=session-model-readiness]")).toContainText("发送前先接入模型")
  await expect(page.locator("[data-testid=session-model-setup]")).toContainText("接入模型")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("RAILWISE")
  await expect(page.locator("[data-testid=session-prompt-input]")).not.toContainText("@chief_manager")
  await expect(page.locator("[data-testid=session-prompt-input]")).not.toContainText("Chief_manager")
  await expect(page.locator("[data-testid=session-prompt-input]")).not.toContainText("chief_manager")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("检查当前线路复测资料")

  await page.locator("[data-action=session-template-drawer]").click()
  const drawer = page.locator("[data-testid=template-drawer]")
  await visible(drawer, 15000)
  await expect(drawer).toContainText("任务模板")
  await expect(drawer).not.toContainText("业务模板")
  await page.locator("[data-testid=category-tab-ppt]").click()
  await page.locator("[data-testid=template-card-project-ppt]").click()
  await expect(drawer).toContainText("汇报生成")
  await expect(drawer).toContainText("填入对话")
  await expect(drawer).not.toContainText("ppt_master")
})

test("已配置模型时首页任务可以创建会话并发送给 chief_manager", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
  await expect(page.locator("[data-testid=home-project-directory]")).toContainText("worktree")
  await page.locator("[data-testid=home-task-input]").fill("用主控智能体检查复测资料，并调用专业智能体列出风险。")
  await page.locator("[data-testid=home-start-session]").click()

  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("DeepSeek V4")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("业务模板")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("默认建议")
  await visible(page.locator("[data-testid=session-status-panel]"), 15000)
  await expect(page.locator("[data-testid=session-status-model]")).toContainText("DeepSeek V4")
  await expect(page.locator("[data-testid=session-model-readiness]")).toHaveCount(0)

  const request = page.waitForRequest((item) => item.url().endsWith("/session/queue-e2e/prompt_async"))
  await page.locator("[data-testid=session-prompt-input]").press("Enter")
  const payload = (await request).postDataJSON() as {
    agent: string
    model: { providerID: string; modelID: string }
    parts: unknown
  }

  await expect(page).toHaveURL(/\/session\/queue-e2e$/)
  await expect(page.locator("[data-testid=session-turn-execution]").first()).toBeVisible()
  await expect(page.locator("[data-testid=session-turn-execution-title]").first()).toHaveText("执行证据")
  await expect(page.locator("[data-testid=session-turn-execution-agent]").first()).toContainText("RAILWISE")
  await expect(page.locator("[data-testid=session-turn-execution-model]").first()).toContainText("DeepSeek V4")
  await expect(page.locator("[data-testid=session-turn-execution-tools]").first()).toHaveText("1/1 完成")
  await expect(page.locator("[data-testid=session-turn-execution-tool-name]").first()).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-turn-execution-tool-state]").first()).toHaveText("完成")
  await expect(page.locator("[data-testid=session-turn-execution-tool-summary]").first()).toContainText("闭合差满足限差")
  await expect(page.locator("[data-testid=session-runtime-state]")).toHaveText("阻塞")
  await expect(page.locator("[data-testid=session-runtime-blockers]")).toHaveText("1 项待处理")
  await expect(page.locator("[data-testid=session-runtime-todos]")).toHaveText("1/2 完成")
  await expect(page.locator("[data-testid=session-runtime-tools]")).toHaveText("1/1 完成")
  await page.locator("[data-testid=session-runtime-tools-row]").click()
  await expect(page.locator("[data-testid=session-runtime-tool-list]")).toBeVisible()
  await expect(page.locator("[data-testid=session-runtime-tool-name]")).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-runtime-tool-summary]")).toContainText("闭合差满足限差")
  expect(payload.agent).toBe("chief_manager")
  expect(payload.model).toEqual({ providerID: "deepseek", modelID: "deepseek-v4" })
  expect(JSON.stringify(payload.parts)).toContain("用主控智能体检查复测资料")
})
