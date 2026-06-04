import { render } from "solid-js/web"
import { MetaProvider } from "@solidjs/meta"
import "@railwise/app/index.css"
import { Font } from "@railwise/ui/font"
import "./styles.css"
import { createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js"
import { commands, events, InitStep } from "./bindings"
import { Channel } from "@tauri-apps/api/core"

const root = document.getElementById("root")!

const PROGRESS_CAP_PERCENT = 90 // Cap simulated progress at 90% to leave room for completion

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

interface LoadingProps {
  phase?: InitPhase
  percent: number
}

const Loading = (props: LoadingProps) => {
  const [progress, setProgress] = createSignal(0)
  const [imageLoadError, setImageLoadError] = createSignal(false)

  const message = createMemo(() => {
    switch (props.phase) {
      case "app-init":
        return "正在初始化应用"
      case "sidecar-init":
        return "正在启动本地执行层"
      case "server-connect":
      case "server_waiting":
        return "正在连接本地服务"
      case "ui-ready":
        return "正在准备工作台"
      case "done":
        return "启动完成"
      case "sqlite_waiting":
        return "正在迁移本地数据"
      default:
        return "正在读取配置"
    }
  })

  const target = createMemo(() => {
    if (props.phase === "sqlite_waiting") return Math.max(65, Math.min(98, props.percent || 80))
    switch (props.phase) {
      case "app-init":
        return 15
      case "sidecar-init":
        return 40
      case "server_waiting":
      case "server-connect":
        return 65
      case "ui-ready":
        return 95
      case "done":
        return 100
      default:
        return 8
    }
  })

  createEffect(() => {
    setProgress(Math.min(target(), props.phase === "done" ? 100 : PROGRESS_CAP_PERCENT))
  })

  return (
    <div class="loading-container">
      <section class="loading-content" aria-label="RAILWISE 启动中">
        <div class="loading-brand">
          <div class="railwise-logo">
            <img
              src="/railwise-logo.svg"
              alt="RAILWISE"
              onError={() => setImageLoadError(true)}
              style={imageLoadError() ? { display: "none" } : {}}
            />
            {imageLoadError() && (
              <div class="logo-fallback">
                <div class="logo-text">R</div>
              </div>
            )}
          </div>

          <div class="loading-brand-copy">
            <div class="loading-kicker">RAILWISE Desktop</div>
            <h1 class="loading-title">RAILWISE 智能协作平台</h1>
          </div>
        </div>

        <div class="loading-body">
          <div class="loading-state">
            <span class="loading-state-dot" />
            <div>
              <div class="loading-state-label">{message()}</div>
              <div class="loading-state-note">启动完成后会进入项目协作工作台</div>
            </div>
          </div>

          <div class="loading-progress" aria-label="启动进度">
            <div class="progress-bar">
              <div class="progress-fill" style={`width: ${progress()}%`} />
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

render(() => {
  const [step, setStep] = createSignal<InitStep | null>(null)
  const [percent, setPercent] = createSignal(0)

  const phase = createMemo(() => step()?.phase as InitPhase | undefined)

  const channel = new Channel<InitStep>()
  channel.onmessage = (next) => setStep(next)
  commands.awaitInitialization(channel as any).catch(() => undefined)

  onMount(() => {
    setPercent(0)

    const listener = events.sqliteMigrationProgress.listen((e) => {
      if (e.payload.type === "InProgress") setPercent(Math.max(0, Math.min(100, e.payload.value)))
      if (e.payload.type === "Done") setPercent(100)
    })

    onCleanup(() => {
      listener.then((cb) => cb())
    })
  })

  createEffect(() => {
    if (phase() !== "done") return

    const timer = setTimeout(() => events.loadingWindowComplete.emit(null), 1000)
    onCleanup(() => clearTimeout(timer))
  })

  return (
    <MetaProvider>
      <Font />
      <Loading phase={phase()} percent={percent()} />
    </MetaProvider>
  )
}, root)
