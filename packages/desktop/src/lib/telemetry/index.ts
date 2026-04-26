import { flush, startBatcher } from "./batcher"
import { sanitize } from "./privacy"
import { clear, insert, setEnabled as setStoredEnabled } from "./store"

export interface TelemetryEvent {
  event: string
  properties: Record<string, unknown>
  ts: number
}

export const telemetryPreferenceEvent = "railwise:telemetry-enabled"

let installed = false

export function track(event: string, properties: Record<string, unknown> = {}) {
  void insert({ event, properties: sanitize(properties), ts: Date.now() })
}

export async function setEnabled(value: boolean) {
  await setStoredEnabled(value)
  if (!value) await clear()
}

export function captureError(error: unknown, source: string) {
  const value = error instanceof Error ? error : new Error(String(error))
  track("desktop_error", {
    source,
    name: value.name,
    message: value.message,
    stack: value.stack,
  })
}

export function installTelemetry() {
  if (installed) return
  installed = true

  window.addEventListener(telemetryPreferenceEvent, (event) => {
    const detail = event instanceof CustomEvent ? (event.detail as { enabled?: unknown }) : undefined
    void setEnabled(detail?.enabled === true)
  })
  window.addEventListener("error", (event) => captureError(event.error ?? event.message, "window.error"))
  window.addEventListener("unhandledrejection", (event) => captureError(event.reason, "unhandledrejection"))

  startBatcher()
}

export { flush }
