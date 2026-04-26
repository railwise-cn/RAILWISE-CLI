import { expect, type Locator } from "@playwright/test"

export async function visible(locator: Locator, timeout = 10_000) {
  await expect(locator).toBeVisible({ timeout })
}

export async function state(locator: Locator, value: string, timeout = 10_000) {
  await expect(locator).toHaveAttribute("data-state", value, { timeout })
}
