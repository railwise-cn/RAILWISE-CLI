import { For, Match, Show, Switch, createEffect, createMemo, createSignal, onCleanup, onMount, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createMediaQuery } from "@solid-primitives/media"
import { useNavigate, useParams } from "@solidjs/router"
import type { CapabilityManifest, Part, ToolPart } from "@railwise/sdk/v2/client"
import { Tabs } from "@railwise/ui/tabs"
import { Icon, type IconProps } from "@railwise/ui/icon"
import { IconButton } from "@railwise/ui/icon-button"
import { Tooltip, TooltipKeybind } from "@railwise/ui/tooltip"
import { ResizeHandle } from "@railwise/ui/resize-handle"
import { Mark } from "@railwise/ui/logo"
import { getFilename } from "@railwise/util/path"
import { DragDropProvider, DragDropSensors, DragOverlay, SortableProvider, closestCenter } from "@thisbeyond/solid-dnd"
import type { DragEvent } from "@thisbeyond/solid-dnd"
import { ConstrainDragYAxis, getDraggableId } from "@/utils/solid-dnd"
import { useDialog } from "@railwise/ui/context/dialog"

import FileTree from "@/components/file-tree"
import { SessionContextUsage } from "@/components/session-context-usage"
import { getSessionContextMetrics } from "@/components/session/session-context-metrics"
import { DialogSelectFile } from "@/components/dialog-select-file"
import { SessionContextTab, SortableTab, FileVisual } from "@/components/session"
import { useCommand } from "@/context/command"
import { useFile, type SelectedLineRange } from "@/context/file"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"
import { usePrompt } from "@/context/prompt"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { createFileTabListSync } from "@/pages/session/file-tab-scroll"
import { FileTabContent } from "@/pages/session/file-tabs"
import { createOpenSessionFileTab, getTabReorderIndex } from "@/pages/session/helpers"
import { StickyAddButton } from "@/pages/session/review-tab"
import { setSessionHandoff } from "@/pages/session/handoff"
import { repairInstruction } from "@/pages/harness/recovery"
import { agentDisplayName } from "@/utils/agent-display"
import { capabilitiesForAgents, capabilitiesFromRouting, normalizeCapabilities } from "@/pages/marketplace/marketplace-state"
import { toolEvidence } from "@/pages/session/tool-evidence"

/** Root-level entries hidden from the "All files" tree to avoid exposing config/internal files. */
const HIDDEN_ROOT_ENTRIES: ReadonlySet<string> = new Set([
  ".railwise",
  ".git",
  "config",
  "bin",
  "app-dist",
  "node_modules",
  "serve.log",
])

function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool"
}

function StatusItem(props: {
  icon: IconProps["name"]
  label: string
  value: string
  testId?: string
  rowTestId?: string
  disabled?: boolean
  expanded?: boolean
  onClick?: () => void
}) {
  const content = (
    <>
      <div class="flex min-w-0 items-center gap-1.5 text-11-medium text-text-weak">
        <Icon name={props.icon} size="small" class="shrink-0 text-icon-weak" />
        <span class="truncate">{props.label}</span>
      </div>
      <div class="flex min-w-0 items-center gap-1">
        <div
          data-testid={props.testId}
          class="max-w-40 truncate text-right text-12-medium text-text-strong"
          title={props.value}
        >
          {props.value}
        </div>
        <Show when={props.onClick && !props.disabled && props.expanded !== undefined}>
          <Icon
            name="chevron-down"
            size="small"
            class="shrink-0 text-icon-weak transition-transform"
            classList={{ "rotate-180": props.expanded }}
          />
        </Show>
      </div>
    </>
  )

  if (props.onClick) {
    return (
      <button
        type="button"
        data-testid={props.rowTestId}
        class="flex w-full min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left hover:bg-background-hover disabled:cursor-default disabled:hover:bg-transparent"
        disabled={props.disabled}
        onClick={props.onClick}
      >
        {content}
      </button>
    )
  }

  return (
    <div data-testid={props.rowTestId} class="flex min-w-0 items-center justify-between gap-2 rounded-md px-2 py-1.5">
      {content}
    </div>
  )
}

function InspectorItem(props: {
  icon: IconProps["name"]
  label: string
  value: string
  testId?: string
}) {
  return (
    <div class="min-w-0 rounded-md border border-border-subtle bg-background-base px-2 py-1.5">
      <div class="flex min-w-0 items-center gap-1.5 text-11-medium text-text-weak">
        <Icon name={props.icon} size="small" class="shrink-0 text-icon-weak" />
        <span class="truncate">{props.label}</span>
      </div>
      <div data-testid={props.testId} class="mt-0.5 truncate text-12-medium text-text-strong" title={props.value}>
        {props.value}
      </div>
    </div>
  )
}

type ChainTone = "done" | "running" | "blocked" | "waiting" | "error"
type ChainStepId = "model" | "agent" | "capabilities" | "tools" | "next"

function ExecutionChainStep(props: {
  id: ChainStepId
  label: string
  status: string
  tone: ChainTone
  value: string
  action?: string
  onAction?: () => void
}) {
  return (
    <div data-testid="session-runtime-chain-step" data-chain-step={props.id} class="flex min-w-0 items-start gap-2 py-1">
      <div class="mt-1.5 flex w-3 shrink-0 justify-center">
        <span
          class="size-2 rounded-full bg-icon-weak"
          classList={{
            "bg-icon-success-base": props.tone === "done",
          }}
        />
      </div>
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center justify-between gap-1.5">
          <span data-testid="session-runtime-chain-label" class="truncate text-11-medium text-text-weak">
            {props.label}
          </span>
          <div class="flex shrink-0 items-center gap-1">
            <span
              data-testid="session-runtime-chain-status"
              class="rounded bg-surface-base px-1.5 py-0.5 text-10-medium text-text-weak"
              classList={{
                "text-text-strong": props.tone === "done" || props.tone === "running",
                "text-text-danger-base": props.tone === "blocked" || props.tone === "error",
              }}
            >
              {props.status}
            </span>
            <Show when={props.action && props.onAction}>
              <button
                type="button"
                data-testid={`session-runtime-chain-action-${props.id}`}
                class="flex h-5 shrink-0 items-center gap-0.5 rounded border border-border-subtle bg-surface-panel px-1.5 text-10-medium text-text-weak hover:bg-background-hover hover:text-text-strong"
                aria-label={props.action}
                title={props.action}
                onClick={props.onAction}
              >
                <span>{props.action}</span>
                <Icon name="chevron-right" size="small" class="text-icon-weak" />
              </button>
            </Show>
          </div>
        </div>
        <div data-testid="session-runtime-chain-value" class="mt-0.5 truncate text-12-medium text-text-strong" title={props.value}>
          {props.value}
        </div>
      </div>
    </div>
  )
}

export function SessionSidePanel(props: {
  reviewPanel: () => JSX.Element
  activeDiff?: string
  focusReviewDiff: (path: string) => void
}) {
  const params = useParams()
  const navigate = useNavigate()
  const layout = useLayout()
  const sdk = useSDK()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const local = useLocal()
  const file = useFile()
  const language = useLanguage()
  const command = useCommand()
  const dialog = useDialog()
  const prompt = usePrompt()
  const [capabilities, setCapabilities] = createSignal<CapabilityManifest[]>([])

  const isDesktop = createMediaQuery("(min-width: 768px)")
  const sessionKey = createMemo(() => `${params.dir}${params.id ? "/" + params.id : ""}`)
  const tabs = createMemo(() => layout.tabs(sessionKey))
  const view = createMemo(() => layout.view(sessionKey))

  const reviewOpen = createMemo(() => isDesktop() && view().reviewPanel.opened())
  const open = createMemo(() => isDesktop() && (view().reviewPanel.opened() || layout.fileTree.opened()))
  const reviewTab = createMemo(() => isDesktop() && !layout.fileTree.opened())

  const info = createMemo(() => (params.id ? sync.session.get(params.id) : undefined))
  const diffs = createMemo(() => (params.id ? (sync.data.session_diff[params.id] ?? []) : []))
  const messages = createMemo(() => (params.id ? (sync.data.message[params.id] ?? []) : []))
  const pendingPermissions = createMemo(() => (params.id ? (sync.data.permission[params.id] ?? []) : []))
  const pendingQuestions = createMemo(() => (params.id ? (sync.data.question[params.id] ?? []) : []))
  const todos = createMemo(() => {
    const id = params.id
    if (!id) return []
    return globalSync.data.session_todo[id] ?? sync.data.todo[id] ?? []
  })
  const reviewCount = createMemo(() => Math.max(info()?.summary?.files ?? 0, diffs().length))
  const hasReview = createMemo(() => reviewCount() > 0)
  const diffsReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    if (!hasReview()) return true
    return sync.data.session_diff[id] !== undefined
  })

  const diffFiles = createMemo(() => diffs().map((d) => d.file))
  const projectName = createMemo(() => {
    const root = sync.project?.worktree ?? sdk.directory
    return sync.project?.name || getFilename(root) || language.t("session.side.project.empty")
  })
  const agentName = createMemo(() => agentDisplayName(local.agent.current()) || language.t("session.side.agent.empty"))
  const currentModel = createMemo(() => local.model.current())
  const modelName = createMemo(() => {
    const model = currentModel()
    if (!model) return language.t("session.side.model.empty")
    return `${model.provider.name} / ${model.name}`
  })
  const messageReady = createMemo(() => {
    const id = params.id
    if (!id) return true
    return sync.data.message[id] !== undefined
  })
  const userMessages = createMemo(() => messages().filter((message) => message.role === "user"))
  const progress = createMemo(() => {
    if (!params.id) return language.t("session.side.progress.ready")
    if (!messageReady()) return language.t("session.side.progress.loading")
    if (userMessages().length === 0) return language.t("session.side.progress.waiting")
    return language.t("session.side.progress.turns", { count: userMessages().length.toLocaleString(language.locale()) })
  })
  const metrics = createMemo(() => getSessionContextMetrics(messages(), sync.data.provider.all))
  const contextLabel = createMemo(() => {
    const context = metrics().context
    if (!params.id) return language.t("session.side.context.pending")
    if (!context) return language.t("session.side.context.empty")
    if (context.usage === null) return `${context.total.toLocaleString(language.locale())} ${language.t("context.usage.tokens")}`
    return language.t("session.side.context.percent", { percent: context.usage.toLocaleString(language.locale()) })
  })
  const blockers = createMemo(() => pendingPermissions().length + pendingQuestions().length)
  const blockerLabel = createMemo(() => {
    if (!params.id) return language.t("session.side.runtime.blockers.ready")
    if (blockers() === 0) return language.t("session.side.runtime.blockers.none")
    return language.t("session.side.runtime.blockers.pending", { count: blockers().toLocaleString(language.locale()) })
  })
  const todoLabel = createMemo(() => {
    const list = todos()
    if (!params.id) return language.t("session.side.runtime.todos.ready")
    if (list.length === 0) return language.t("session.side.runtime.todos.empty")
    const done = list.filter((todo) => todo.status === "completed" || todo.status === "cancelled").length
    return language.t("session.side.runtime.todos.progress", {
      done: done.toLocaleString(language.locale()),
      total: list.length.toLocaleString(language.locale()),
    })
  })
  const toolParts = createMemo(() =>
    messages()
      .flatMap((message) => sync.data.part[message.id] ?? [])
      .filter(isToolPart),
  )
  const toolStats = createMemo(() => {
    const tools = toolParts()
    return {
      total: tools.length,
      running: tools.filter((part) => part.state.status === "pending" || part.state.status === "running").length,
      done: tools.filter((part) => part.state.status === "completed").length,
      error: tools.filter((part) => part.state.status === "error").length,
    }
  })
  const toolLabel = createMemo(() => {
    const stats = toolStats()
    if (stats.total === 0) return language.t("session.side.runtime.tools.empty")
    if (stats.running > 0)
      return language.t("session.side.runtime.tools.running", { count: stats.running.toLocaleString(language.locale()) })
    if (stats.error > 0)
      return language.t("session.side.runtime.tools.error", { count: stats.error.toLocaleString(language.locale()) })
    return language.t("session.side.runtime.tools.done", {
      done: stats.done.toLocaleString(language.locale()),
      total: stats.total.toLocaleString(language.locale()),
    })
  })
  const recentTools = createMemo(() => toolParts().slice(-3).reverse())
  const activeAgents = createMemo(() =>
    Array.from(
      new Set(
        [local.agent.current()?.name, ...messages().map((message) => message.agent)].filter((item): item is string =>
          Boolean(item),
        ),
      ),
    ),
  )
  const routedCapabilities = createMemo(() =>
    capabilitiesFromRouting(capabilities(), userMessages().flatMap((message) => sync.data.part[message.id] ?? [])).slice(0, 5),
  )
  const runtimeCapabilities = createMemo(() => {
    const scoped = routedCapabilities()
    if (scoped.length > 0) return scoped
    return capabilitiesForAgents(capabilities(), activeAgents().map((name) => ({ name }))).slice(0, 5)
  })
  const capabilityLabel = createMemo(() => {
    const total = runtimeCapabilities().length
    if (!params.id) return language.t("session.side.runtime.capabilities.ready")
    if (total === 0) return language.t("session.side.runtime.capabilities.empty")
    return language.t("session.side.runtime.capabilities.count", { count: total.toLocaleString(language.locale()) })
  })
  const toolTitle = (part: ToolPart) => {
    if (part.state.status === "completed") return part.state.title || part.tool
    if (part.state.status === "running") return part.state.title || part.tool
    return part.tool
  }
  const toolStateLabel = (part: ToolPart) => {
    if (part.state.status === "pending") return language.t("session.side.runtime.tool.pending")
    if (part.state.status === "running") return language.t("session.side.runtime.tool.running")
    if (part.state.status === "completed") return language.t("session.side.runtime.tool.completed")
    return language.t("session.side.runtime.tool.error")
  }
  const sessionState = createMemo(() => (params.id ? sync.data.session_status[params.id] : undefined))
  const runtimeStateLabel = createMemo(() => {
    const state = sessionState()
    if (blockers() > 0) return language.t("session.side.runtime.state.blocked")
    if (!params.id) return language.t("session.side.runtime.state.ready")
    if (!state) return language.t("session.side.runtime.state.loading")
    if (state.type === "busy") return language.t("session.side.runtime.state.busy")
    if (state.type === "retry")
      return language.t("session.side.runtime.state.retry", { attempt: state.attempt.toLocaleString(language.locale()) })
    return language.t("session.side.runtime.state.idle")
  })
  const executionChain = createMemo(() => {
    const stats = toolStats()
    const todoList = todos()
    const pendingTodos = todoList.filter((todo) => todo.status !== "completed" && todo.status !== "cancelled").length
    const toolTone: ChainTone =
      stats.error > 0 ? "error" : stats.running > 0 ? "running" : stats.total > 0 ? "done" : "waiting"
    const nextTone: ChainTone = blockers() > 0 ? "blocked" : pendingTodos > 0 ? "running" : params.id ? "waiting" : "done"
    const nextValue =
      blockers() > 0
        ? blockerLabel()
        : todoList.length > 0
          ? todoLabel()
          : params.id
            ? language.t("session.side.runtime.chain.next.waiting")
            : language.t("session.side.runtime.chain.next.ready")

    return [
      {
        id: "model" as const,
        label: language.t("session.side.runtime.chain.model"),
        status: language.t(currentModel() ? "session.side.runtime.chain.status.done" : "session.side.runtime.chain.status.blocked"),
        tone: currentModel() ? ("done" as const) : ("blocked" as const),
        value: modelName(),
        action: language.t(
          currentModel() ? "session.side.runtime.chain.action.switchModel" : "session.side.runtime.chain.action.connectModel",
        ),
      },
      {
        id: "agent" as const,
        label: language.t("session.side.runtime.chain.agent"),
        status: language.t(activeAgents().length > 0 ? "session.side.runtime.chain.status.done" : "session.side.runtime.chain.status.waiting"),
        tone: activeAgents().length > 0 ? ("done" as const) : ("waiting" as const),
        value: activeAgents().map(agentDisplayName).join(" / ") || agentName(),
        action: language.t("session.side.runtime.chain.action.configure"),
      },
      {
        id: "capabilities" as const,
        label: language.t("session.side.runtime.chain.capabilities"),
        status: language.t(
          runtimeCapabilities().length > 0 ? "session.side.runtime.chain.status.done" : "session.side.runtime.chain.status.waiting",
        ),
        tone: runtimeCapabilities().length > 0 ? ("done" as const) : ("waiting" as const),
        value: capabilityLabel(),
        action: language.t("session.side.runtime.chain.action.view"),
      },
      {
        id: "tools" as const,
        label: language.t("session.side.runtime.chain.tools"),
        status: language.t(`session.side.runtime.chain.status.${toolTone}`),
        tone: toolTone,
        value: toolLabel(),
        action: language.t(stats.error > 0 ? "session.side.runtime.chain.action.repair" : "session.side.runtime.chain.action.view"),
      },
      {
        id: "next" as const,
        label: language.t("session.side.runtime.chain.next"),
        status: language.t(`session.side.runtime.chain.status.${nextTone}`),
        tone: nextTone,
        value: nextValue,
        action: language.t(
          blockers() > 0
            ? "session.side.runtime.chain.action.handle"
            : pendingTodos > 0
              ? "session.side.runtime.chain.action.focus"
              : "session.side.runtime.chain.action.input",
        ),
      },
    ]
  })
  const kinds = createMemo(() => {
    const merge = (a: "add" | "del" | "mix" | undefined, b: "add" | "del" | "mix") => {
      if (!a) return b
      if (a === b) return a
      return "mix" as const
    }

    const normalize = (p: string) => p.replaceAll("\\\\", "/").replace(/\/+$/, "")

    const out = new Map<string, "add" | "del" | "mix">()
    for (const diff of diffs()) {
      const file = normalize(diff.file)
      const kind = diff.status === "added" ? "add" : diff.status === "deleted" ? "del" : "mix"

      out.set(file, kind)

      const parts = file.split("/")
      for (const [idx] of parts.slice(0, -1).entries()) {
        const dir = parts.slice(0, idx + 1).join("/")
        if (!dir) continue
        out.set(dir, merge(out.get(dir), kind))
      }
    }
    return out
  })

  const normalizeTab = (tab: string) => {
    if (!tab.startsWith("file://")) return tab
    return file.tab(tab)
  }

  const openReviewPanel = () => {
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
  }

  const openTab = createOpenSessionFileTab({
    normalizeTab,
    openTab: tabs().open,
    pathFromTab: file.pathFromTab,
    loadFile: file.load,
    openReviewPanel,
    setActive: tabs().setActive,
  })

  const contextOpen = createMemo(() => tabs().active() === "context" || tabs().all().includes("context"))
  const openedTabs = createMemo(() =>
    tabs()
      .all()
      .filter((tab) => tab !== "context" && tab !== "review"),
  )

  const activeTab = createMemo(() => {
    const active = tabs().active()
    if (active === "context") return "context"
    if (active === "review" && reviewTab()) return "review"
    if (active && file.pathFromTab(active)) return normalizeTab(active)

    const first = openedTabs()[0]
    if (first) return first
    if (contextOpen()) return "context"
    if (reviewTab() && hasReview()) return "review"
    return "empty"
  })

  const activeFileTab = createMemo(() => {
    const active = activeTab()
    if (!openedTabs().includes(active)) return
    return active
  })

  const fileTreeTab = () => layout.fileTree.tab()

  const setFileTreeTabValue = (value: string) => {
    if (value !== "changes" && value !== "all") return
    layout.fileTree.setTab(value)
  }

  const showAllFiles = () => {
    if (fileTreeTab() !== "changes") return
    layout.fileTree.setTab("all")
  }

  const openContext = () => {
    if (!params.id) return
    if (!view().reviewPanel.opened()) view().reviewPanel.open()
    if (layout.fileTree.opened() && layout.fileTree.tab() !== "all") layout.fileTree.setTab("all")
    tabs().open("context")
    tabs().setActive("context")
  }

  const [store, setStore] = createStore({
    activeDraggable: undefined as string | undefined,
    capabilitiesOpen: false,
    toolsOpen: false,
  })

  onMount(() => {
    void sdk.client.marketplace.capabilities
      .list()
      .then((result) => setCapabilities(normalizeCapabilities(result)))
      .catch(() => setCapabilities([]))
  })

  const focusPromptDock = () => {
    const dock = document.querySelector('[data-component="session-prompt-dock"]')
    if (!(dock instanceof HTMLElement)) return
    dock.scrollIntoView({ block: "center", behavior: "smooth" })
    requestAnimationFrame(() => {
      const target = dock.querySelector(
        'button:not([disabled]), textarea:not([disabled]), [contenteditable="true"]',
      )
      if (target instanceof HTMLElement) target.focus()
    })
  }

  const openArtifact = (path: string) => {
    showAllFiles()
    openTab(file.tab(path))
  }

  const referenceArtifact = (path: string) => {
    prompt.context.add({ type: "file", path })
    focusPromptDock()
  }

  const repairTool = (part: ToolPart) => {
    if (part.state.status !== "error") return
    const text = repairInstruction(part)
    setSessionHandoff(sessionKey(), { prompt: text })
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
    focusPromptDock()
  }

  const toggleTools = () => {
    if (toolStats().total === 0) return
    setStore("toolsOpen", (value) => !value)
  }

  const toggleCapabilities = () => {
    if (runtimeCapabilities().length === 0) return
    setStore("capabilitiesOpen", (value) => !value)
  }

  const runExecutionChainAction = (id: ChainStepId) => {
    if (id === "model") {
      navigate("/marketplace")
      return
    }
    if (id === "agent") {
      navigate("/agents")
      return
    }
    if (id === "capabilities") {
      if (runtimeCapabilities().length > 0) {
        toggleCapabilities()
        return
      }
      navigate("/marketplace")
      return
    }
    if (id === "tools") {
      if (toolStats().error > 0 || toolStats().total === 0) {
        navigate("/harness")
        return
      }
      toggleTools()
      return
    }
    focusPromptDock()
  }

  const handleDragStart = (event: unknown) => {
    const id = getDraggableId(event)
    if (!id) return
    setStore("activeDraggable", id)
  }

  const handleDragOver = (event: DragEvent) => {
    const { draggable, droppable } = event
    if (!draggable || !droppable) return

    const currentTabs = tabs().all()
    const toIndex = getTabReorderIndex(currentTabs, draggable.id.toString(), droppable.id.toString())
    if (toIndex === undefined) return
    tabs().move(draggable.id.toString(), toIndex)
  }

  const handleDragEnd = () => {
    setStore("activeDraggable", undefined)
  }

  createEffect(() => {
    if (!file.ready()) return

    setSessionHandoff(sessionKey(), {
      files: tabs()
        .all()
        .reduce<Record<string, SelectedLineRange | null>>((acc, tab) => {
          const path = file.pathFromTab(tab)
          if (!path) return acc

          const selected = file.selectedLines(path)
          acc[path] =
            selected && typeof selected === "object" && "start" in selected && "end" in selected
              ? (selected as SelectedLineRange)
              : null

          return acc
        }, {}),
    })
  })

  return (
    <Show when={open()}>
      <aside
        id="review-panel"
        aria-label={language.t("session.panel.reviewAndFiles")}
        class="relative min-w-0 h-full border-l border-border-weak-base flex"
        classList={{
          "flex-1": reviewOpen(),
          "shrink-0": !reviewOpen(),
        }}
        style={{ width: reviewOpen() ? undefined : `${layout.fileTree.width()}px` }}
      >
        <Show when={reviewOpen()}>
          <div class="flex-1 min-w-0 h-full">
            <Show
              when={layout.fileTree.opened() && fileTreeTab() === "changes"}
              fallback={
                <DragDropProvider
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragOver={handleDragOver}
                  collisionDetector={closestCenter}
                >
                  <DragDropSensors />
                  <ConstrainDragYAxis />
                  <Tabs value={activeTab()} onChange={openTab}>
                    <div class="sticky top-0 shrink-0 flex">
                      <Tabs.List
                        ref={(el: HTMLDivElement) => {
                          const stop = createFileTabListSync({ el, contextOpen })
                          onCleanup(stop)
                        }}
                      >
                        <Show when={reviewTab()}>
                          <Tabs.Trigger value="review" classes={{ button: "!pl-6" }}>
                            <div class="flex items-center gap-1.5">
                              <div>{language.t("session.tab.review")}</div>
                              <Show when={hasReview()}>
                                <div class="text-12-medium text-text-strong h-4 px-2 flex flex-col items-center justify-center rounded-full bg-surface-base">
                                  {reviewCount()}
                                </div>
                              </Show>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <Show when={contextOpen()}>
                          <Tabs.Trigger
                            value="context"
                            closeButton={
                              <Tooltip value={language.t("common.closeTab")} placement="bottom">
                                <IconButton
                                  icon="close-small"
                                  variant="ghost"
                                  class="h-5 w-5"
                                  onClick={() => tabs().close("context")}
                                  aria-label={language.t("common.closeTab")}
                                />
                              </Tooltip>
                            }
                            hideCloseButton
                            onMiddleClick={() => tabs().close("context")}
                          >
                            <div class="flex items-center gap-2">
                              <SessionContextUsage variant="indicator" />
                              <div>{language.t("session.tab.context")}</div>
                            </div>
                          </Tabs.Trigger>
                        </Show>
                        <SortableProvider ids={openedTabs()}>
                          <For each={openedTabs()}>{(tab) => <SortableTab tab={tab} onTabClose={tabs().close} />}</For>
                        </SortableProvider>
                        <StickyAddButton>
                          <TooltipKeybind
                            title={language.t("command.file.open")}
                            keybind={command.keybind("file.open")}
                            class="flex items-center"
                          >
                            <IconButton
                              icon="plus-small"
                              variant="ghost"
                              iconSize="large"
                              onClick={() =>
                                dialog.show(() => <DialogSelectFile mode="files" onOpenFile={showAllFiles} />)
                              }
                              aria-label={language.t("command.file.open")}
                            />
                          </TooltipKeybind>
                        </StickyAddButton>
                      </Tabs.List>
                    </div>

                    <Show when={reviewTab()}>
                      <Tabs.Content value="review" class="flex flex-col h-full overflow-hidden contain-strict">
                        <Show when={activeTab() === "review"}>{props.reviewPanel()}</Show>
                      </Tabs.Content>
                    </Show>

                    <Tabs.Content value="empty" class="flex flex-col h-full overflow-hidden contain-strict">
                      <Show when={activeTab() === "empty"}>
                        <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                          <div class="h-full px-6 pb-42 flex flex-col items-center justify-center text-center gap-6">
                            <Mark class="w-14 opacity-10" />
                            <div class="text-14-regular text-text-weak max-w-56">
                              {language.t("session.files.selectToOpen")}
                            </div>
                          </div>
                        </div>
                      </Show>
                    </Tabs.Content>

                    <Show when={contextOpen()}>
                      <Tabs.Content value="context" class="flex flex-col h-full overflow-hidden contain-strict">
                        <Show when={activeTab() === "context"}>
                          <div class="relative pt-2 flex-1 min-h-0 overflow-hidden">
                            <SessionContextTab />
                          </div>
                        </Show>
                      </Tabs.Content>
                    </Show>

                    <Show when={activeFileTab()} keyed>
                      {(tab) => <FileTabContent tab={tab} />}
                    </Show>
                  </Tabs>
                  <DragOverlay>
                    <Show when={store.activeDraggable} keyed>
                      {(tab) => {
                        const path = createMemo(() => file.pathFromTab(tab))
                        return (
                          <div class="relative px-6 h-12 flex items-center bg-background-stronger border-x border-border-weak-base border-b border-b-transparent">
                            <Show when={path()}>{(p) => <FileVisual active path={p()} />}</Show>
                          </div>
                        )
                      }}
                    </Show>
                  </DragOverlay>
                </DragDropProvider>
              }
            >
              {props.reviewPanel()}
            </Show>
          </div>
        </Show>

        <Show when={layout.fileTree.opened()}>
          <div id="file-tree-panel" class="relative shrink-0 h-full" style={{ width: `${layout.fileTree.width()}px` }}>
            <div
              class="h-full flex flex-col overflow-hidden group/filetree"
              classList={{ "border-l border-border-weak-base": reviewOpen() }}
            >
              <div
                data-testid="session-status-panel"
                class="shrink-0 border-b border-border-subtle bg-background-stronger px-3 py-2.5"
              >
                <div class="mb-2 flex items-center justify-between gap-2">
                  <div class="text-12-medium text-text-strong">{language.t("session.side.title")}</div>
                  <div class="rounded-md bg-surface-base px-2 py-1 text-11-medium text-text-weak">
                    {params.id ? language.t("session.side.status.active") : language.t("session.side.status.ready")}
                  </div>
                </div>
                <div class="grid grid-cols-2 gap-1.5" data-testid="session-inspector-summary">
                  <InspectorItem
                    icon="folder"
                    label={language.t("session.side.project")}
                    value={projectName()}
                    testId="session-status-project"
                  />
                  <InspectorItem
                    icon="brain"
                    label={language.t("session.side.agent")}
                    value={agentName()}
                    testId="session-status-agent"
                  />
                  <InspectorItem
                    icon="models"
                    label={language.t("session.side.model")}
                    value={modelName()}
                    testId="session-status-model"
                  />
                  <InspectorItem
                    icon="checklist"
                    label={language.t("session.side.progress")}
                    value={progress()}
                    testId="session-status-progress"
                  />
                </div>
                <button
                  type="button"
                  data-testid="session-status-context"
                  class="mt-2 flex h-7 w-full min-w-0 items-center justify-between gap-2 rounded-md border border-border-subtle bg-background-base px-2.5 text-left text-12-medium text-text-base hover:bg-background-hover disabled:cursor-default disabled:opacity-50 disabled:hover:bg-background-base"
                  disabled={!params.id}
                  onClick={openContext}
                >
                  <span class="flex min-w-0 items-center gap-1.5">
                    <Icon name="bullet-list" size="small" class="shrink-0 text-icon-weak" />
                    <span class="shrink-0 text-text-weak">{language.t("session.side.context")}</span>
                  </span>
                  <span class="truncate text-text-strong">{contextLabel()}</span>
                </button>
                <div data-testid="session-runtime-panel" class="mt-3 border-t border-border-subtle pt-2">
                  <div class="mb-1 flex items-center justify-between gap-2">
                    <div class="text-11-medium text-text-weak">{language.t("session.side.runtime.title")}</div>
                    <div
                      data-testid="session-runtime-state"
                      class="rounded-md bg-surface-base px-2 py-0.5 text-11-medium text-text-weak"
                    >
                      {runtimeStateLabel()}
                    </div>
                  </div>
                  <div
                    data-testid="session-runtime-chain"
                    class="mb-2 rounded-md border border-border-subtle bg-background-base px-2 py-1.5"
                  >
                    <div class="mb-1 text-11-medium text-text-weak">{language.t("session.side.runtime.chain.title")}</div>
                    <For each={executionChain()}>
                      {(step) => (
                        <ExecutionChainStep
                          id={step.id}
                          label={step.label}
                          status={step.status}
                          tone={step.tone}
                          value={step.value}
                          action={step.action}
                          onAction={() => runExecutionChainAction(step.id)}
                        />
                      )}
                    </For>
                  </div>
                  <div class="grid grid-cols-2 gap-1" data-testid="session-runtime-metrics">
                    <StatusItem
                      icon="warning"
                      label={language.t("session.side.runtime.blockers")}
                      value={blockerLabel()}
                      testId="session-runtime-blockers"
                      rowTestId="session-runtime-blockers-row"
                      disabled={blockers() === 0}
                      onClick={focusPromptDock}
                    />
                    <StatusItem
                      icon="checklist"
                      label={language.t("session.side.runtime.todos")}
                      value={todoLabel()}
                      testId="session-runtime-todos"
                      rowTestId="session-runtime-todos-row"
                      disabled={todos().length === 0}
                      onClick={focusPromptDock}
                    />
                    <StatusItem
                      icon="providers"
                      label={language.t("session.side.runtime.capabilities")}
                      value={capabilityLabel()}
                      testId="session-runtime-capabilities"
                      rowTestId="session-runtime-capabilities-row"
                      disabled={runtimeCapabilities().length === 0}
                      expanded={store.capabilitiesOpen}
                      onClick={toggleCapabilities}
                    />
                    <StatusItem
                      icon="console"
                      label={language.t("session.side.runtime.tools")}
                      value={toolLabel()}
                      testId="session-runtime-tools"
                      rowTestId="session-runtime-tools-row"
                      disabled={toolStats().total === 0}
                      expanded={store.toolsOpen}
                      onClick={toggleTools}
                    />
                  </div>
                  <Show when={store.capabilitiesOpen && runtimeCapabilities().length > 0}>
                    <div data-testid="session-runtime-capability-list" class="mt-2 space-y-1">
                      <For each={runtimeCapabilities()}>
                        {(item) => (
                          <div class="rounded-md border border-border-subtle bg-background-base px-2 py-1.5">
                            <div
                              data-testid="session-runtime-capability-name"
                              class="truncate text-12-medium text-text-strong"
                              title={item.description}
                            >
                              {item.name}
                            </div>
                            <div class="mt-0.5 truncate text-11-regular text-text-weak">{item.description}</div>
                          </div>
                        )}
                      </For>
                    </div>
                  </Show>
                  <Show when={store.toolsOpen && recentTools().length > 0}>
                    <div data-testid="session-runtime-tool-list" class="mt-2 space-y-1">
                      <For each={recentTools()}>
                        {(part) => {
                          const evidence = toolEvidence(part)
                          return (
                            <div class="rounded-md border border-border-subtle bg-background-base px-2 py-1.5">
                              <div class="flex min-w-0 items-center justify-between gap-2">
                                <div
                                  data-testid="session-runtime-tool-name"
                                  class="min-w-0 truncate text-12-medium text-text-strong"
                                  title={toolTitle(part)}
                                >
                                  {toolTitle(part)}
                                </div>
                                <div class="flex shrink-0 items-center gap-1">
                                  <div
                                    data-testid="session-runtime-tool-risk"
                                    class="rounded px-1.5 py-0.5 text-10-medium"
                                    classList={{
                                      "bg-surface-success-base text-text-on-success-base": evidence.risk.tone === "success",
                                      "bg-surface-warning-base text-text-on-warning-base": evidence.risk.tone === "warning",
                                      "bg-surface-critical-base text-text-on-critical-base": evidence.risk.tone === "danger",
                                      "bg-surface-base text-text-weak": evidence.risk.tone === "neutral",
                                    }}
                                  >
                                    {evidence.risk.label}
                                  </div>
                                  <div class="rounded bg-surface-base px-1.5 py-0.5 text-10-medium text-text-weak">
                                    {toolStateLabel(part)}
                                  </div>
                                </div>
                              </div>
                              <Show when={evidence.input}>
                                {(input) => (
                                  <div
                                    data-testid="session-runtime-tool-input"
                                    class="mt-1 line-clamp-1 text-11-regular text-text-weak"
                                    title={input()}
                                  >
                                    输入：{input()}
                                  </div>
                                )}
                              </Show>
                              <Show when={evidence.output}>
                                {(output) => (
                                  <div
                                    data-testid="session-runtime-tool-summary"
                                    class="mt-1 line-clamp-2 text-11-regular text-text-weak"
                                    title={output()}
                                  >
                                    输出：{output()}
                                  </div>
                                )}
                              </Show>
                              <Show when={part.state.status === "error"}>
                                <button
                                  type="button"
                                  data-testid="session-runtime-tool-repair"
                                  class="mt-1 flex h-5 w-fit items-center gap-0.5 rounded border border-border-subtle bg-surface-panel px-1.5 text-10-medium text-text-weak hover:bg-background-hover hover:text-text-strong"
                                  onClick={() => repairTool(part)}
                                >
                                  {language.t("session.side.runtime.chain.action.repair")}
                                  <Icon name="chevron-right" size="small" class="text-icon-weak" />
                                </button>
                              </Show>
                              <Show when={evidence.artifacts.length > 0}>
                                <div data-testid="session-runtime-tool-artifacts" class="mt-1.5 flex min-w-0 flex-wrap gap-1">
                                  <For each={evidence.artifacts}>
                                    {(artifact) => (
                                      <div
                                        data-testid="session-runtime-tool-artifact-row"
                                        class="flex max-w-full items-center overflow-hidden rounded-full border border-border-subtle bg-surface-base text-text-weak hover:border-border-base"
                                        title={artifact.path}
                                      >
                                        <button
                                          type="button"
                                          data-testid="session-runtime-tool-artifact"
                                          class="min-w-0 truncate px-1.5 py-0.5 text-left text-10-medium hover:bg-background-hover hover:text-text-strong"
                                          aria-label={`打开 ${artifact.label}`}
                                          onClick={() => openArtifact(artifact.path)}
                                        >
                                          {artifact.label}
                                        </button>
                                        <Tooltip value={language.t("prompt.context.includeActiveFile")} placement="top">
                                          <button
                                            type="button"
                                            data-testid="session-runtime-tool-artifact-reference"
                                            class="flex h-5 w-5 shrink-0 items-center justify-center border-l border-border-subtle hover:bg-background-hover hover:text-text-strong"
                                            aria-label={`引用 ${artifact.label} 到对话`}
                                            onClick={() => referenceArtifact(artifact.path)}
                                          >
                                            <Icon name="link" size="small" class="text-icon-weak" />
                                          </button>
                                        </Tooltip>
                                      </div>
                                    )}
                                  </For>
                                </div>
                              </Show>
                            </div>
                          )
                        }}
                      </For>
                    </div>
                  </Show>
                </div>
              </div>
              <Tabs
                variant="pill"
                value={fileTreeTab()}
                onChange={setFileTreeTabValue}
                class="h-full"
                data-scope="filetree"
              >
                <Tabs.List>
                  <Tabs.Trigger value="changes" class="flex-1" classes={{ button: "w-full" }}>
                    {reviewCount()}{" "}
                    {language.t(reviewCount() === 1 ? "session.review.change.one" : "session.review.change.other")}
                  </Tabs.Trigger>
                  <Tabs.Trigger value="all" class="flex-1" classes={{ button: "w-full" }}>
                    {language.t("session.files.all")}
                  </Tabs.Trigger>
                </Tabs.List>
                <Tabs.Content value="changes" class="bg-background-stronger px-3 py-0">
                  <Switch>
                    <Match when={hasReview()}>
                      <Show
                        when={diffsReady()}
                        fallback={
                          <div class="px-2 py-2 text-12-regular text-text-weak">
                            {language.t("common.loading")}
                            {language.t("common.loading.ellipsis")}
                          </div>
                        }
                      >
                        <FileTree
                          path=""
                          allowed={diffFiles()}
                          kinds={kinds()}
                          draggable={false}
                          active={props.activeDiff}
                          onFileClick={(node) => props.focusReviewDiff(node.path)}
                        />
                      </Show>
                    </Match>
                    <Match when={true}>
                      <div class="mt-8 text-center text-12-regular text-text-weak">
                        {language.t("session.review.noChanges")}
                      </div>
                    </Match>
                  </Switch>
                </Tabs.Content>
                <Tabs.Content value="all" class="bg-background-stronger px-3 py-0">
                  <FileTree
                    path=""
                    modified={diffFiles()}
                    kinds={kinds()}
                    hidden={HIDDEN_ROOT_ENTRIES}
                    onFileClick={(node) => openTab(file.tab(node.path))}
                  />
                </Tabs.Content>
              </Tabs>
            </div>
            <ResizeHandle
              direction="horizontal"
              edge="start"
              size={layout.fileTree.width()}
              min={200}
              max={480}
              collapseThreshold={160}
              onResize={layout.fileTree.resize}
              onCollapse={layout.fileTree.close}
            />
          </div>
        </Show>
      </aside>
    </Show>
  )
}
