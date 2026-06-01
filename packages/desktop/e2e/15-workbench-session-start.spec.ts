import { expect, test } from "./helpers/app"

test("Workbench 可从资料目录和任务输入直接启动会话", async ({ launchApp }) => {
  const prompt = "检查当前目录中的测量资料，列出缺失文件。"
  const { page } = await launchApp("/home", { pickerPath: "/tmp/railwise-e2e/worktree" })

  await expect(page.getByTestId("workbench-page")).toBeVisible()
  await page.getByRole("button", { name: "选择资料目录" }).first().click()
  await expect(page.getByText(/railwise-e2e\/worktree/)).toBeVisible()

  await page.getByPlaceholder("例如：检查当前线路复测资料，列出缺失文件并给出下一步执行计划。").fill(prompt)
  const submit = page.waitForRequest((request) => request.url().includes("/session/queue-e2e/prompt_async"))
  await page.getByRole("button", { name: "开始会话" }).click()

  await expect(page).toHaveURL(/\/session\/queue-e2e/)
  expect((await submit).postData() ?? "").toContain(prompt)
})
