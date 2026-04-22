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

// Enhanced Loading Component with phase-based messaging for M1 Foundation
interface LoadingProps {
  phase?: string
}

const Loading = (props: LoadingProps) => {
  const [progress, setProgress] = createSignal(0)

  const getPhaseMessage = (phase?: string): string => {
    // Use existing translation keys that are type-safe
    switch (phase) {
      case "sidecar-init":
        return t("desktop.loading.startingServer")
      case "server-connect":
        return t("desktop.loading.connectingProviders")
      case "ui-ready":
        return t("desktop.loading.loadingAgents")
      case "done":
        return t("desktop.loading.ready")
      case "sqlite_waiting":
        return t("desktop.loading.migratingDatabase")
      default:
        return t("desktop.loading.readingConfig")
    }
  }

  onMount(() => {
    // Set progress to 100% for done phase, simulate for others
    if (props.phase === "done") {
      setProgress(100)
    } else {
      const interval = setInterval(() => {
        setProgress(prev => Math.min(prev + Math.random() * 10, 90))
      }, 100)
      onCleanup(() => clearInterval(interval))
    }
  })

  return (
    <div class="loading-container">
      <div class="loading-content">
        <div class="railwise-logo">
          <img src="/railwise-logo.svg" alt="RAILWISE" />
        </div>

        <h1 class="loading-title">RAILWISE 智测工作台</h1>

        <div class="loading-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              style={`width: ${progress()}%`}
            />
          </div>
          <p class="loading-message">{getPhaseMessage(props.phase)}</p>
        </div>
      </div>
    </div>
  )
}

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

  // Enhanced phase mapping for M1 Foundation with fallback to original logic
  const status = createMemo(() => {
    if (phase() === "done") return t("desktop.loading.ready")
    if (phase() === "sqlite_waiting") {
      // line 0,1,2 — all map to migratingDatabase; cycling implicit via percent.
      void line()
      return t("desktop.loading.migratingDatabase")
    }
    // Map phases to M1 Foundation specifications
    switch (phase()) {
      case "sidecar_init":
        return t("desktop.loading.starting")
      case "server_connect":
        return t("desktop.loading.connecting")
      case "ui_ready":
        return t("desktop.loading.initializing")
      default:
        return t("desktop.loading.readingConfig")
    }
  })

  // Use enhanced loading component for all phases including done
  if (phase() === "done") {
    return (
      <MetaProvider>
        <Font />
        <Loading phase={phase()} />
      </MetaProvider>
    )
  }

  return (
    <MetaProvider>
      <Font />
      <Loading phase={phase()} />
    </MetaProvider>
  )
}, root)
