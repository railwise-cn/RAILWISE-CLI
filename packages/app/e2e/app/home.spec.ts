import { test, expect } from "../fixtures"
import { seedProjects, seedSessionPermission, sessionIDFromUrl } from "../actions"
import { createSdk } from "../utils"

test("home renders the Workbench entrypoints", async ({ page }) => {
  await page.goto("/")

  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "告诉 RAILWISE 你想完成什么" })).toBeVisible()
  await expect(page.getByRole("button", { name: "选择资料目录" })).toBeVisible()
  await expect(page.getByText("会话产物")).toBeVisible()
  await expect(page.getByRole("link", { name: "能力市场" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Harness" })).toBeVisible()
  await expect(page.getByRole("button", { name: "Open project" })).toHaveCount(0)
})

test("Workbench navigation opens capability pages", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("link", { name: "能力市场" }).click()
  await expect(page.getByTestId("marketplace-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "能力市场" })).toBeVisible()

  await page.getByRole("link", { name: "返回工作台" }).click()
  await expect(page.getByTestId("workbench-page")).toBeVisible()

  await page.getByRole("link", { name: "Harness" }).click()
  await expect(page.getByTestId("harness-page")).toBeVisible()
  await expect(page.getByRole("heading", { name: "运行时控制台" })).toBeVisible()
})

test("Workbench starts and resumes a real submitted session from the task box", async ({ page, sdk, directory }) => {
  test.setTimeout(120_000)
  await seedProjects(page, { directory })
  await page.goto("/")

  const token = `E2E_OK_${Date.now()}`
  await page
    .getByPlaceholder("例如：检查当前线路复测资料，列出缺失文件并给出下一步执行计划。")
    .fill(`Reply with exactly: ${token}`)
  await page.getByRole("button", { name: "开始会话" }).click()
  await expect(page).toHaveURL(/\/session\/[^/?#]+/, { timeout: 30_000 })

  const sessionID = sessionIDFromUrl(page.url())
  if (!sessionID) throw new Error(`Failed to parse session id from url: ${page.url()}`)

  await expect
    .poll(
      async () => {
        const messages = await sdk.session.messages({ sessionID, limit: 50 }).then((result) => result.data ?? [])
        return messages
          .filter((message) => message.info.role === "user")
          .flatMap((message) => message.parts)
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
      },
      { timeout: 30_000 },
    )
    .toContain(token)

  await page.goto("/")
  const resume = page.getByRole("link", { name: "继续会话" }).first()
  await expect(resume).toBeVisible()
  await expect(page.locator(".workbench-resume")).toContainText("可继续协作")
  await expect(page.getByTestId("workbench-session-status").filter({ hasText: "可继续协作" })).toHaveCount(1)
  await resume.click()
  await expect(page).toHaveURL(new RegExp(`/session/${sessionID}(?:[/?#]|$)`))
})

test("Workbench routes pending permission requests back to the active session", async ({ page, withProject }) => {
  test.setTimeout(120_000)
  await withProject(async (project) => {
    const sdk = createSdk(project.directory)
    await page.goto("/")

    await page
      .getByPlaceholder("例如：检查当前线路复测资料，列出缺失文件并给出下一步执行计划。")
      .fill("列出当前目录文件。")
    await page.getByRole("button", { name: "开始会话" }).click()
    await expect(page).toHaveURL(/\/session\/[^/?#]+/, { timeout: 30_000 })

    const sessionID = sessionIDFromUrl(page.url())
    if (!sessionID) throw new Error(`Failed to parse session id from url: ${page.url()}`)

    await seedSessionPermission(sdk, {
      sessionID,
      permission: "bash",
      patterns: ["README.md"],
      description: "seed workbench permission action",
    })

    await page.goto("/")
    const action = page.getByRole("link", { name: "处理权限" }).first()
    await expect(action).toBeVisible()
    await expect(page.locator(".workbench-resume")).toContainText("1 个权限等待确认")
    await action.click()
    await expect(page).toHaveURL(new RegExp(`/session/${sessionID}(?:[/?#]|$)`))
  })
})
