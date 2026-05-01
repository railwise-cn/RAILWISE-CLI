import { check, type Update } from "@tauri-apps/plugin-updater"
import { relaunch } from "@tauri-apps/plugin-process"
import { type as ostype } from "@tauri-apps/plugin-os"

import { initI18n, t } from "./i18n"
import { commands } from "./bindings"

export const UPDATER_ENABLED = window.__RAILWISE__?.updatesEnabled ?? false
export const updaterCheckEvent = "railwise:update-check"

export type MockUpdate = { version: string; notes: string }
export type UpdaterCheckDetail = { alertOnFail: boolean; mock?: MockUpdate }
type UpdaterStatus = "none" | "check_failed" | "download_failed"

export type DownloadedUpdate = {
  update: Update
  notes: string
}

export function runUpdater(detail: UpdaterCheckDetail) {
  window.dispatchEvent(new CustomEvent(updaterCheckEvent, { detail }))
}

export function createMockUpdate(input: MockUpdate): DownloadedUpdate {
  return {
    update: {
      available: true,
      currentVersion: "0.0.0",
      version: input.version,
      body: input.notes,
      rawJson: {},
      download: async () => undefined,
      install: async () => undefined,
      downloadAndInstall: async () => undefined,
      close: async () => undefined,
    } as Update,
    notes: input.notes,
  }
}

export async function checkForUpdate(opts: {
  alertOnFail: boolean
  onStatus?: (status: UpdaterStatus) => void | Promise<void>
}): Promise<DownloadedUpdate | undefined> {
  if (!UPDATER_ENABLED) {
    if (opts.alertOnFail) await opts.onStatus?.("none")
    return undefined
  }

  await initI18n()

  let update
  try {
    update = await check()
  } catch {
    if (opts.alertOnFail) await opts.onStatus?.("check_failed")
    return undefined
  }

  if (!update) {
    if (opts.alertOnFail) await opts.onStatus?.("none")
    return undefined
  }

  try {
    await update.download()
  } catch {
    if (opts.alertOnFail) await opts.onStatus?.("download_failed")
    return undefined
  }

  return {
    update,
    notes: update.body?.trim() || t("desktop.updater.readyToInstall"),
  }
}

export async function installUpdate(update: NonNullable<Awaited<ReturnType<typeof check>>>) {
  try {
    if (ostype() === "windows") await commands.killSidecar()
    await update.install()
  } catch {
    return false
  }

  await commands.killSidecar()
  await relaunch()
  return true
}
