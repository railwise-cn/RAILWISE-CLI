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

// Constants for progress animation and migration timing
const PROGRESS_CAP_PERCENT = 90 // Cap simulated progress at 90% to leave room for completion
const PROGRESS_UPDATE_INTERVAL = 200 // Update interval in ms (increased from 100ms for performance)
const PROGRESS_INCREMENT_MIN = 1 // Minimum progress increment per update
const PROGRESS_INCREMENT_MAX = 8 // Maximum progress increment per update

// Cycle through migration sub-phases for long sqlite_waiting (preserves
// existing UX when migration takes >3s / >9s).
const MIGRATION_DELAYS = [3000, 9000]

// Define valid phase types for type safety - based on actual InitStep from bindings
// Plus additional phases that may be used in extended contexts
type InitPhase =
  | "server_waiting" // From bindings.ts InitStep
  | "sqlite_waiting" // From bindings.ts InitStep
  | "done"           // From bindings.ts InitStep
  | "app-init"       // Enhanced phase for M1 Foundation
  | "sidecar-init"   // Extended phase for UI consistency
  | "server-connect" // Extended phase
  | "ui-ready"       // Extended phase

// Enhanced Loading Component with phase-based messaging for M1 Foundation
interface LoadingProps {
  phase?: InitPhase
}

const Loading = (props: LoadingProps) => {
  const [progress, setProgress] = createSignal(0)
  const [imageLoadError, setImageLoadError] = createSignal(false)

  const getPhaseMessage = (phase?: InitPhase): string => {
    try {
      // Enhanced phase messages with Chinese for better UX
      switch (phase) {
        case "app-init":
          return "初始化应用程序..."
        case "sidecar-init":
          return "启动本地服务器..."
        case "server-connect":
          return "连接到服务器..."
        case "server_waiting":
          return "等待服务器响应..."
        case "ui-ready":
          return "准备用户界面..."
        case "done":
          return "启动完成！"
        case "sqlite_waiting":
          return "正在迁移数据库..."
        default:
          return "正在读取配置..."
      }
    } catch (error) {
      // Fallback message if translation fails
      console.warn("Translation failed for phase:", phase, error)
      return "Loading..."
    }
  }

  // Calculate realistic progress based on phase and expected timing
  const calculatePhaseProgress = (phase?: InitPhase): number => {
    switch (phase) {
      case "app-init":
        return 15 // Fast initialization
      case "sidecar-init":
        return 40 // Major work happening
      case "server_waiting":
      case "server-connect":
        return 65 // Server connection
      case "sqlite_waiting":
        return 80 // Database migration can take time
      case "ui-ready":
        return 95 // Almost ready
      case "done":
        return 100
      default:
        return 5 // Initial state
    }
  }

  onMount(() => {
    // Set target progress based on current phase
    const targetProgress = calculatePhaseProgress(props.phase)

    if (props.phase === "done") {
      setProgress(100)
    } else if (targetProgress > 0) {
      // Animate to the target progress for this phase
      let animationId: number
      const startProgress = progress()
      const progressDiff = targetProgress - startProgress
      const duration = 800 // 800ms animation duration

      const startTime = performance.now()

      const animateToTarget = (currentTime: number) => {
        const elapsed = currentTime - startTime
        const progressRatio = Math.min(elapsed / duration, 1)

        // Ease-out animation
        const easedRatio = 1 - Math.pow(1 - progressRatio, 3)
        const newProgress = startProgress + (progressDiff * easedRatio)

        setProgress(Math.min(newProgress, PROGRESS_CAP_PERCENT))

        if (progressRatio < 1 && props.phase !== "done") {
          animationId = requestAnimationFrame(animateToTarget)
        }
      }

      if (progressDiff > 0) {
        animationId = requestAnimationFrame(animateToTarget)
        onCleanup(() => cancelAnimationFrame(animationId))
      }
    }
  })

  return (
    <div class="loading-container">
      <div class="loading-content">
        <div class="railwise-logo">
          <img
            src="/railwise-logo.svg"
            alt="RAILWISE"
            onError={() => setImageLoadError(true)}
            style={imageLoadError() ? { display: "none" } : {}}
          />
          {imageLoadError() && (
            <div class="logo-fallback">
              <div class="logo-text">RAILWISE</div>
            </div>
          )}
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

  const phase = createMemo(() => step()?.phase as InitPhase | undefined)

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

  // Enhanced phase mapping for M1 Foundation with consistent phase names
  const status = createMemo(() => {
    try {
      if (phase() === "done") return t("desktop.loading.ready")
      if (phase() === "sqlite_waiting") {
        // line 0,1,2 — all map to migratingDatabase; cycling implicit via percent.
        void line()
        return t("desktop.loading.migratingDatabase")
      }
      // Map phases to M1 Foundation specifications (standardized phase names)
      switch (phase()) {
        case "sidecar-init":  // Standardized to match UI naming convention
          return t("desktop.loading.starting")
        case "server-connect":
          return t("desktop.loading.connecting")
        case "server_waiting":
          return t("desktop.loading.connecting")
        case "ui-ready":
          return t("desktop.loading.initializing")
        default:
          return t("desktop.loading.readingConfig")
      }
    } catch (error) {
      // Fallback message if translation fails
      console.warn("Translation failed for main status phase:", phase(), error)
      return "Loading..."
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
