import { message } from "@tauri-apps/plugin-dialog"
import { createSignal, onCleanup, onMount, Show } from "solid-js"

import { UpdateDialog } from "./components/update-dialog"
import { initI18n, t } from "./i18n"
import {
  checkForUpdate,
  createMockUpdate,
  installUpdate,
  type DownloadedUpdate,
  updaterCheckEvent,
  type UpdaterCheckDetail,
} from "./updater"

export function UpdateController() {
  const [update, setUpdate] = createSignal<DownloadedUpdate>()
  const [busy, setBusy] = createSignal(false)

  const showMessage = async (title: string, value: string) => {
    await message(value, { title }).catch(() => undefined)
  }

  const check = async (detail: UpdaterCheckDetail) => {
    await initI18n()
    if (busy()) return
    setBusy(true)

    if (detail.mock) {
      setUpdate(createMockUpdate(detail.mock))
      setBusy(false)
      return
    }

    const next = await checkForUpdate({
      alertOnFail: detail.alertOnFail,
      onStatus: async (status) => {
        if (!detail.alertOnFail) return
        if (status === "none") await showMessage(t("desktop.updater.none.title"), t("desktop.updater.none.message"))
        if (status === "check_failed")
          await showMessage(t("desktop.updater.checkFailed.title"), t("desktop.updater.checkFailed.message"))
        if (status === "download_failed")
          await showMessage(t("desktop.updater.downloadFailed.title"), t("desktop.updater.downloadFailed.message"))
      },
    })

    setBusy(false)
    if (next) setUpdate(next)
  }

  const install = async () => {
    const next = update()
    if (!next || busy()) return
    setBusy(true)
    const ok = await installUpdate(next.update)
    if (!ok) {
      setBusy(false)
      await showMessage(t("desktop.updater.installFailed.title"), t("desktop.updater.installFailed.message"))
    }
  }

  onMount(() => {
    const listener = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as UpdaterCheckDetail | undefined) : undefined
      void check(detail ?? { alertOnFail: false })
    }

    window.addEventListener(updaterCheckEvent, listener)
    onCleanup(() => {
      window.removeEventListener(updaterCheckEvent, listener)
    })
  })

  return (
    <Show when={update()}>
      {(next) => (
        <UpdateDialog
          busy={busy()}
          version={next().update.version}
          notes={next().notes}
          onLater={() => setUpdate(undefined)}
          onUpdate={install}
        />
      )}
    </Show>
  )
}
