import { render } from "solid-js/web"
import { MetaProvider } from "@solidjs/meta"
import "@railwise/app/index.css"
import { Font } from "@railwise/ui/font"
import { Splash } from "@railwise/ui/logo"
import { Progress } from "@railwise/ui/progress"
import "./styles.css"
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { commands, events, InitStep } from "./bindings"
import { Channel } from "@tauri-apps/api/core"
import { t } from "./i18n"

const root = document.getElementById("root")!

// Cream white + warm brown — locked from §2.8 design tokens.
const BG = "rgb(251, 251, 249)"
const ACCENT = "rgba(117, 86, 32, 0.9)"
const TEXT_PRIMARY = "rgb(10, 10, 9)"
const TEXT_SECONDARY = "rgba(47, 38, 24, 0.7)"
const FONT_STACK = '"PingFang SC", "Helvetica Neue", "Microsoft YaHei", sans-serif'

// Cycle through migration sub-phases for long sqlite_waiting (preserves
// existing UX when migration takes >3s / >9s).
const MIGRATION_DELAYS = [3000, 9000]

render(() => {
  const [step, setStep] = createSignal<InitStep | null>(null)
  const [line, setLine] = createSignal(0)
  const [percent, setPercent] = createSignal(0)

  const phase = createMemo(() => step()?.phase)

  const value = createMemo(() => {
    if (phase() === "done") return 100
    return Math.max(25, Math.min(100, percent()))
  })

  const channel = new Channel<InitStep>()
  channel.onmessage = (next) => setStep(next)
  commands.awaitInitialization(channel as any).catch(() => undefined)

  onMount(() => {
    setLine(0)
    setPercent(0)

    const timers = MIGRATION_DELAYS.map((ms, i) => setTimeout(() => setLine(i + 1), ms))

    const listener = events.sqliteMigrationProgress.listen((e) => {
      if (e.payload.type === "InProgress") setPercent(Math.max(0, Math.min(100, e.payload.value)))
      if (e.payload.type === "Done") setPercent(100)
    })

    onCleanup(() => {
      listener.then((cb) => cb())
      timers.forEach(clearTimeout)
    })
  })

  createEffect(() => {
    if (phase() !== "done") return

    const timer = setTimeout(() => events.loadingWindowComplete.emit(null), 1000)
    onCleanup(() => clearTimeout(timer))
  })

  // Phase → i18n key. Migration sub-phase keeps the same key but the line
  // counter still drives the cycling animation timing for long migrations.
  const status = createMemo(() => {
    if (phase() === "done") return t("desktop.loading.ready")
    if (phase() === "sqlite_waiting") {
      // line 0,1,2 — all map to migratingDatabase; cycling implicit via percent.
      void line()
      return t("desktop.loading.migratingDatabase")
    }
    return t("desktop.loading.readingConfig")
  })

  return (
    <MetaProvider>
      <div
        class="w-screen h-screen flex items-center justify-center"
        style={{ "background-color": BG, "font-family": FONT_STACK }}
      >
        <Font />
        <div class="flex flex-col items-center gap-8">
          <Splash class="w-20 h-25 opacity-80" />
          <div class="flex flex-col items-center gap-1">
            <span
              class="text-xl font-semibold tracking-wide"
              style={{ color: TEXT_PRIMARY }}
            >
              睿威智测 RAILWISE
            </span>
            <span class="text-xs tracking-wider" style={{ color: TEXT_SECONDARY }}>
              Railwise AI 工程测绘多智能体系统
            </span>
          </div>
          <div class="w-60 flex flex-col items-center gap-3" aria-live="polite">
            <span
              class="w-full overflow-hidden text-center text-ellipsis whitespace-nowrap text-sm"
              style={{ color: ACCENT }}
            >
              {status()}
            </span>
            <Progress
              value={value()}
              class="w-20 [&_[data-slot='progress-track']]:h-1 [&_[data-slot='progress-track']]:border-0 [&_[data-slot='progress-track']]:rounded-none [&_[data-slot='progress-track']]:bg-surface-weak [&_[data-slot='progress-fill']]:rounded-none [&_[data-slot='progress-fill']]:bg-icon-warning-base"
              aria-label="启动进度"
              getValueLabel={({ value }) => `${Math.round(value)}%`}
            />
          </div>
        </div>
      </div>
    </MetaProvider>
  )
}, root)
