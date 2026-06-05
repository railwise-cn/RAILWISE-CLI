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
  await expect(page.locator("[data-testid=home-workbench]")).toContainText("想让 RAILWISE 完成什么？")
  await expect(
    page.evaluate(
      () =>
        (window as Window & { __RAILWISE__?: { browserHarness?: boolean } }).__RAILWISE__?.browserHarness === true,
    ),
  ).resolves.toBe(true)
  expect(errors).toEqual([])
})

test("首页未配置模型时可以直接打开模型接入入口", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.locator("[data-testid=home-model-summary]")).toContainText("默认建议 DeepSeek V4")
  await expect(page.locator("[data-testid=home-connect-model]")).toContainText("接入 DeepSeek")
  await page.locator("[data-testid=home-connect-model]").click()

  const dialog = page.locator("[data-component=dialog]")
  await visible(dialog, 15000)
  await expect(dialog).toContainText("DeepSeek")
  await expect(dialog).toContainText(/API|密钥/)
})

test("首页任务输入直接进入 chief_manager 协作会话", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
  await expect(page.locator("[data-testid=home-project-directory]")).toContainText("worktree")
  await expect(page.locator("[data-testid=home-agent-capability-preview]")).toContainText("RAILWISE 将调用")
  await expect(page.locator("[data-testid=home-agent-capability-preview]")).toContainText("轨道交通监测方案")
  await expect(page.locator("[data-testid=home-agent-capability-preview]")).toContainText("规范条文速查")
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
  await expect(page.locator("[data-testid=session-inspector-summary]")).toBeVisible()
  await visible(page.locator("[data-testid=session-collaboration-panel]"), 15000)
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("RAILWISE")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("模型")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("模板")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).toContainText("能力")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("业务模板")
  await expect(page.locator("[data-testid=session-collaboration-panel]")).not.toContainText("默认建议")
  await expect(page.locator("[data-testid=session-status-panel]")).toContainText("状态")
  await expect(page.locator("[data-testid=session-runtime-panel]")).toContainText("执行")
  await expect(page.locator("[data-testid=session-runtime-metrics]")).toBeVisible()
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
  await page.locator("[data-testid=session-collaboration-panel]").getByRole("button", { name: "能力" }).click()
  await page.locator("[data-testid=session-collaboration-panel]").getByRole("button", { name: "水准闭合差检核" }).click()
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("tool: survey_calculator_leveling_closure")
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
    workspaceFiles: [
      { path: `${worktree}/成果报告.md`, kind: "md", content: "# 成果报告\n\n成果报告：运营期监测预警复核。" },
      { path: `${worktree}/闭合差复核.md`, kind: "md", content: "# 闭合差复核\n\n闭合差满足限差。" },
    ],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await expect(page.getByText("worktree").first()).toBeVisible()
  await expect(page.locator("[data-testid=home-project-directory]")).toContainText("worktree")
  await page.locator("[data-testid=home-task-input]").fill("让 RAILWISE 检查复测资料，并调用专业智能体列出风险。")
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
  await expect(page.locator("[data-testid=session-turn-execution-capabilities]").first()).toContainText("能力")
  await expect(page.locator("[data-testid=session-turn-execution-capabilities]").first()).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-turn-execution-capabilities]").first()).toContainText("复测资料检查")
  await expect(page.locator("[data-testid=session-turn-execution-tools]").first()).toHaveText("1/1 完成")
  await expect(page.locator("[data-testid=session-turn-execution-tool-name]").first()).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-turn-execution-tool-state]").first()).toHaveText("完成")
  await expect(page.locator("[data-testid=session-turn-execution-tool-summary]").first()).toContainText("闭合差满足限差")
  await expect(page.locator("[data-testid=session-turn-execution-tool-risk]").first()).toHaveText("通过")
  await expect(page.locator("[data-testid=session-turn-execution-tool-input]").first()).toContainText("运营期监测数据.xlsx")
  await expect(page.locator("[data-testid=session-turn-execution-tool-artifact]").first()).toContainText("成果报告.md")
  await expect(page.locator("[data-testid=session-runtime-state]")).toHaveText("阻塞")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("执行链路")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("DeepSeek V4")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("RAILWISE")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("2 项能力")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("1/1 完成")
  await expect(page.locator("[data-testid=session-runtime-chain]")).toContainText("1 项待处理")
  await expect(page.locator("[data-testid=session-runtime-chain-action-model]")).toHaveText("更换")
  await expect(page.locator("[data-testid=session-runtime-chain-action-agent]")).toHaveText("配置")
  await expect(page.locator("[data-testid=session-runtime-chain-action-capabilities]")).toHaveText("查看")
  await expect(page.locator("[data-testid=session-runtime-chain-action-tools]")).toHaveText("查看")
  await expect(page.locator("[data-testid=session-runtime-chain-action-next]")).toHaveText("处理")
  await expect(page.locator("[data-testid=session-runtime-blockers]")).toHaveText("1 项待处理")
  await expect(page.locator("[data-testid=session-runtime-todos]")).toHaveText("1/2 完成")
  await expect(page.locator("[data-testid=session-runtime-capabilities]")).toHaveText("2 项能力")
  await expect(page.locator("[data-testid=session-runtime-tools]")).toHaveText("1/1 完成")
  await page.locator("[data-testid=session-runtime-capabilities-row]").click()
  await expect(page.locator("[data-testid=session-runtime-capability-list]")).toBeVisible()
  await expect(page.locator("[data-testid=session-runtime-capability-list]")).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-runtime-capability-list]")).toContainText("复测资料检查")
  await page.locator("[data-testid=session-runtime-tools-row]").click()
  await expect(page.locator("[data-testid=session-runtime-tool-list]")).toBeVisible()
  await expect(page.locator("[data-testid=session-runtime-tool-name]")).toContainText("水准闭合差检核")
  await expect(page.locator("[data-testid=session-runtime-tool-risk]")).toHaveText("通过")
  await expect(page.locator("[data-testid=session-runtime-tool-input]")).toContainText("运营期监测数据.xlsx")
  await expect(page.locator("[data-testid=session-runtime-tool-summary]")).toContainText("闭合差满足限差")
  await expect(page.locator("[data-testid=session-runtime-tool-artifacts]")).toContainText("成果报告.md")
  await expect(page.locator("[data-testid=session-runtime-tool-artifacts]")).toContainText("闭合差复核.md")
  await page.locator("[data-testid=session-runtime-tool-artifact]").filter({ hasText: "成果报告.md" }).click()
  await expect(page.locator("[data-component=code]")).toContainText("成果报告：运营期监测预警复核。")
  expect(payload.agent).toBe("chief_manager")
  expect(payload.model).toEqual({ providerID: "deepseek", modelID: "deepseek-v4" })
  expect(JSON.stringify(payload.parts)).toContain("让 RAILWISE 检查复测资料")
})

test("失败工具可以把修复提示带回对话框", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    toolFailure: true,
    permission: "none",
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await page.locator("[data-testid=home-task-input]").fill("复核控制点成果目录，找出缺失资料。")
  await page.locator("[data-testid=home-start-session]").click()
  await visible(page.locator("[data-testid=session-status-panel]"), 15000)
  const request = page.waitForRequest((item) => item.url().endsWith("/session/queue-e2e/prompt_async"))
  await page.locator("[data-testid=session-prompt-input]").press("Enter")
  await request
  await expect(page).toHaveURL(/\/session\/queue-e2e$/)
  await visible(page.locator("[data-testid=session-prompt-input]"), 15000)
  await expect(page.locator("[data-testid=session-runtime-tools]")).toHaveText("1 个错误")
  await page.locator("[data-testid=session-runtime-tools-row]").click()
  await expect(page.locator("[data-testid=session-runtime-tool-risk]").first()).toHaveText("失败")
  await expect(page.locator("[data-testid=session-runtime-tool-input]").first()).toContainText("控制点成果/CP001.xlsx")
  await page.locator("[data-testid=session-runtime-tool-repair]").first().click()
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("请继续处理刚才失败的工具调用。")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("失败类型：工作区文件")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("控制点成果/CP001.xlsx")
})

test("权限处理后可以立即回到对话框继续协作", async ({ launchApp }) => {
  const worktree = "/tmp/railwise-e2e/worktree"
  const { page } = await launchApp("/home", {
    model: "configured",
    projects: [{ id: "railwise-e2e", worktree, time: { created: Date.now(), updated: Date.now() } }],
  })

  await state(page.locator("[data-testid=sidecar-status]"), "ready", 15000)
  await page.locator("[data-testid=home-task-input]").fill("生成成果报告初稿，并在需要时申请写入权限。")
  await page.locator("[data-testid=home-start-session]").click()
  await visible(page.locator("[data-testid=session-status-panel]"), 15000)
  const request = page.waitForRequest((item) => item.url().endsWith("/session/queue-e2e/prompt_async"))
  await page.locator("[data-testid=session-prompt-input]").press("Enter")
  await request
  await expect(page).toHaveURL(/\/session\/queue-e2e$/)
  await expect(page.getByText("需要权限")).toBeVisible()
  await expect(page.getByRole("code").filter({ hasText: "成果报告.md" })).toBeVisible()
  await page.getByRole("button", { name: "允许一次" }).click()
  await visible(page.locator("[data-testid=session-prompt-input]"), 15000)
  await page.locator("[data-testid=session-prompt-input]").fill("继续生成报告。")
  await expect(page.locator("[data-testid=session-prompt-input]")).toContainText("继续生成报告。")
  const followup = page.waitForRequest((item) => item.url().endsWith("/session/queue-e2e/prompt_async"))
  await page.locator("[data-testid=session-prompt-input]").press("Enter")
  expect(JSON.stringify((await followup).postDataJSON())).toContain("继续生成报告")
})
