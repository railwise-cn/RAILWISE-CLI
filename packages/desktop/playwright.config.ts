import { defineConfig, devices } from "@playwright/test"
import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import path from "node:path"

const port = Number(process.env.PLAYWRIGHT_PORT ?? 5185)
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`
const vite = `bun ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port ${port}`
const command = process.platform === "darwin" ? `zsh -lc '${vite}'` : vite
const cached = () => {
  const root = path.join(homedir(), "Library/Caches/ms-playwright")
  if (!existsSync(root)) return undefined
  return readdirSync(root)
    .filter((item) => item.startsWith("chromium-"))
    .sort()
    .reverse()
    .map((item) =>
      path.join(
        root,
        item,
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
      ),
    )
    .find((item) => existsSync(item))
}
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ?? (process.platform === "darwin" ? cached() : undefined)
const channel = process.env.PLAYWRIGHT_CHROMIUM_CHANNEL
const reuse = !process.env.CI
const webServer =
  process.env.PLAYWRIGHT_SKIP_WEBSERVER === "1"
    ? undefined
    : {
        command,
        url: baseURL,
        reuseExistingServer: reuse,
        timeout: 120_000,
      }

export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/test-results",
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: process.env.PLAYWRIGHT_FULLY_PARALLEL === "1",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["html", { outputFolder: "e2e/playwright-report", open: "never" }], ["line"]],
  webServer,
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        ...(executablePath ? { launchOptions: { executablePath } } : channel ? { channel } : {}),
      },
    },
  ],
})
