import { expect, test } from "./helpers/app"

test("未接入模型时清晰引导 DeepSeek 与 OpenRouter", async ({ launchApp }) => {
  const { page } = await launchApp("/agents")

  await expect(page.getByText("默认建议 DeepSeek V4")).toBeVisible()
  await expect(page.getByRole("button", { name: "接入 DeepSeek" })).toBeVisible()
  await expect(page.getByRole("button", { name: "接入 OpenRouter" })).toBeVisible()
})
