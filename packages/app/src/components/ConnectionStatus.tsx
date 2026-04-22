import { Match, Show, Switch } from "solid-js"
import { useGlobalSDK } from "@/context/global-sdk"

const STYLES = {
  connected: {
    dot: "rgba(82, 196, 26, 0.9)",
    label: "已连接",
    show: false,
  },
  reconnecting: {
    dot: "rgba(250, 173, 20, 0.95)",
    label: "重连中...",
    show: true,
  },
  disconnected: {
    dot: "rgba(255, 77, 79, 0.95)",
    label: "已断开",
    show: true,
  },
} as const

/**
 * Small floating dot in the bottom-right corner that surfaces the SSE event
 * stream health. Stays hidden while the connection is healthy and only
 * appears during reconnect / disconnect — minimizing visual noise but
 * preserving the user's ability to spot a stalled UI immediately.
 *
 * Style intentionally aligns with §2.8 design tokens (奶白 / 暖棕),
 * sourced from packages/desktop/src/styles.css `--shadow-sm` /
 * `--text-secondary` / `--font-family` when those are available.
 */
export function ConnectionStatus() {
  const sdk = useGlobalSDK()
  const status = sdk.connectionStatus
  return (
    <Show when={STYLES[status()].show}>
      <div
        class="fixed bottom-3 right-3 z-50 flex items-center gap-1.5 px-2 py-1 rounded-full text-xs select-none pointer-events-none"
        style={{
          background: "rgba(255,255,255,0.85)",
          "box-shadow": "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05))",
          "font-family": 'var(--font-family, "PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif)',
          color: "var(--text-secondary, rgb(47, 38, 24))",
          border: "1px solid rgba(0,0,0,0.06)",
        }}
        role="status"
        aria-live="polite"
      >
        <Switch>
          <Match when={status() === "reconnecting"}>
            <span
              class="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ "background-color": STYLES.reconnecting.dot }}
              aria-hidden="true"
            />
            <span>{STYLES.reconnecting.label}</span>
          </Match>
          <Match when={status() === "disconnected"}>
            <span
              class="w-1.5 h-1.5 rounded-full"
              style={{ "background-color": STYLES.disconnected.dot }}
              aria-hidden="true"
            />
            <span>{STYLES.disconnected.label}</span>
          </Match>
        </Switch>
      </div>
    </Show>
  )
}
