import { expect, test, type Page } from "@playwright/test"

test("启动页使用 RAILWISE 品牌启动体验", async ({ page }) => {
  await mockTauri(page)
  await page.goto("/loading")

  await expect(page.locator(".loading-content")).toBeVisible({ timeout: 15_000 })
  await expect(page.locator(".loading-kicker")).toHaveText("RAILWISE Desktop")
  await expect(page.locator(".loading-title")).toHaveText("RAILWISE 智能协作平台")
  await expect(page.locator(".loading-state-label")).toHaveText("正在读取配置")
  await expect(page.locator(".loading-state-note")).toContainText("项目协作工作台")
  await expect(page.getByText("RAILWISE 智测工作台")).toHaveCount(0)

  const color = await page.locator(".progress-fill").evaluate((node) => getComputedStyle(node).backgroundColor)
  expect(color).toBe("rgb(10, 10, 9)")
})

async function mockTauri(page: Page) {
  await page.addInitScript(() => {
    type Callback = (data: unknown) => unknown
    type TauriWindow = Window &
      typeof globalThis & {
        __TAURI_INTERNALS__?: {
          callbacks: Map<number, Callback>
          convertFileSrc: (path: string) => string
          invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>
          runCallback: (id: number, data: unknown) => void
          transformCallback: (callback?: Callback, once?: boolean) => number
          unregisterCallback: (id: number) => void
        }
      }

    const win = window as TauriWindow
    const callbacks = new Map<number, Callback>()
    let next = 1

    win.__TAURI_INTERNALS__ = {
      callbacks,
      convertFileSrc: (path) => `asset://localhost/${encodeURIComponent(path)}`,
      invoke: async (command, args = {}) => {
        if (command === "await_initialization") {
          const event = args.events
          const id =
            typeof event === "string" && event.startsWith("__CHANNEL__:")
              ? Number(event.slice("__CHANNEL__:".length))
              : typeof event === "object" && event && "id" in event
                ? Number(event.id)
                : undefined
          if (id) {
            setTimeout(() => {
              win.__TAURI_INTERNALS__?.runCallback(id, {
                id: 0,
                message: { phase: "server_waiting" },
                end: false,
              })
            }, 50)
          }
          return { url: "http://127.0.0.1:4096", password: null }
        }
        if (command.startsWith("plugin:event|listen")) return 1
        if (command.startsWith("plugin:event|emit")) return null
        return null
      },
      runCallback: (id, data) => void callbacks.get(id)?.(data),
      transformCallback: (callback, once = false) => {
        const id = next++
        callbacks.set(id, (data) => {
          if (once) callbacks.delete(id)
          return callback?.(data)
        })
        return id
      },
      unregisterCallback: (id) => callbacks.delete(id),
    }
  })
}
