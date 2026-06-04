import { expect, test } from "./helpers/app"
import { state, visible } from "./helpers/wait"

test("启动后 sidecar 在 15s 内就绪", async ({ launchApp }) => {
  const { page } = await launchApp()

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.locator("[data-testid=home-workbench]")).toBeVisible()
})

test("首页任务输入直接进入 chief_manager 协作会话", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
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
  await expect(page.locator("[data-testid=session-status-agent]")).toHaveText("chief_manager")
  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("chief_manager")
  await expect(page.locator("[data-testid=session-model-readiness]")).toContainText("发送前先接入模型")
  await expect(page.locator("[data-testid=session-model-setup]")).toContainText("接入模型")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("@chief_manager")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("检查当前线路复测资料")
})

test("已配置模型时首页任务可以创建会话并发送给 chief_manager", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
  await page.locator("[data-testid=home-task-input]").fill("用主控智能体检查复测资料，并调用专业智能体列出风险。")
  await page.locator("[data-testid=home-start-session]").click()

  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("DeepSeek V4")
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
