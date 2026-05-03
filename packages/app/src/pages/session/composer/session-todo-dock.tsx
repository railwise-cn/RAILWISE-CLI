import type { Todo } from "@railwise/sdk/v2"
import { Checkbox } from "@railwise/ui/checkbox"
import { DockTray } from "@railwise/ui/dock-surface"
import { IconButton } from "@railwise/ui/icon-button"
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import "./session-todo-dock.css"

function dot(status: Todo["status"]) {
  if (status !== "in_progress") return undefined
  return (
    <svg
      viewBox="0 0 12 12"
      width="12"
      height="12"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      class="block"
    >
      <circle
        cx="6"
        cy="6"
        r="3"
        style={{
          animation: "var(--animate-pulse-scale)",
          "transform-origin": "center",
          "transform-box": "fill-box",
        }}
      />
    </svg>
  )
}

export function SessionTodoDock(props: { todos: Todo[]; title: string; collapseLabel: string; expandLabel: string }) {
  const [store, setStore] = createStore({
    collapsed: false,
  })

  const toggle = () => setStore("collapsed", (value) => !value)

  const summary = createMemo(() => {
    const total = props.todos.length
    if (total === 0) return ""
    const completed = props.todos.filter((todo) => todo.status === "completed").length
    return `${completed} of ${total} ${props.title.toLowerCase()} completed`
  })

  const active = createMemo(
    () =>
      props.todos.find((todo) => todo.status === "in_progress") ??
      props.todos.find((todo) => todo.status === "pending") ??
      props.todos.filter((todo) => todo.status === "completed").at(-1) ??
      props.todos[0],
  )

  const preview = createMemo(() => active()?.content ?? "")

  return (
    <DockTray data-component="session-todo-dock" data-collapsed={store.collapsed}>
      <div
        data-action="session-todo-toggle"
        role="button"
        tabIndex={0}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          toggle()
        }}
      >
        <span data-slot="session-todo-summary">{summary()}</span>
        <Show when={store.collapsed}>
          <div data-slot="session-todo-preview-wrap">
            <Show when={preview()}>
              <div data-slot="session-todo-preview">{preview()}</div>
            </Show>
          </div>
        </Show>
        <div data-slot="session-todo-toggle-control" data-collapsed={store.collapsed}>
          <IconButton
            data-action="session-todo-toggle-button"
            icon="chevron-down"
            size="normal"
            variant="ghost"
            classList={{ "rotate-180": !store.collapsed }}
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            onClick={(event) => {
              event.stopPropagation()
              toggle()
            }}
            aria-label={store.collapsed ? props.expandLabel : props.collapseLabel}
          />
        </div>
      </div>

      <div data-slot="session-todo-list" hidden={store.collapsed}>
        <TodoList todos={props.todos} open={!store.collapsed} />
      </div>
    </DockTray>
  )
}

function TodoList(props: { todos: Todo[]; open: boolean }) {
  const [stuck, setStuck] = createSignal(false)
  const [scrolling, setScrolling] = createSignal(false)
  let scrollRef!: HTMLDivElement
  let timer: number | undefined

  const inProgress = createMemo(() => props.todos.findIndex((todo) => todo.status === "in_progress"))

  const ensure = () => {
    if (!props.open) return
    if (scrolling()) return
    if (!scrollRef || scrollRef.offsetParent === null) return

    const el = scrollRef.querySelector("[data-in-progress]")
    if (!(el instanceof HTMLElement)) return

    const topFade = 16
    const bottomFade = 44
    const container = scrollRef.getBoundingClientRect()
    const rect = el.getBoundingClientRect()
    const top = rect.top - container.top + scrollRef.scrollTop
    const bottom = rect.bottom - container.top + scrollRef.scrollTop
    const viewTop = scrollRef.scrollTop + topFade
    const viewBottom = scrollRef.scrollTop + scrollRef.clientHeight - bottomFade

    if (top < viewTop) {
      scrollRef.scrollTop = Math.max(0, top - topFade)
    } else if (bottom > viewBottom) {
      scrollRef.scrollTop = bottom - (scrollRef.clientHeight - bottomFade)
    }

    setStuck(scrollRef.scrollTop > 0)
  }

  createEffect(
    on([() => props.open, inProgress], () => {
      if (!props.open || inProgress() < 0) return
      requestAnimationFrame(ensure)
    }),
  )

  onCleanup(() => {
    if (!timer) return
    window.clearTimeout(timer)
  })

  return (
    <div data-slot="session-todo-list-frame">
      <div
        data-slot="session-todo-scroll"
        ref={scrollRef}
        onScroll={(e) => {
          setStuck(e.currentTarget.scrollTop > 0)
          setScrolling(true)
          if (timer) window.clearTimeout(timer)
          timer = window.setTimeout(() => {
            setScrolling(false)
            if (inProgress() < 0) return
            requestAnimationFrame(ensure)
          }, 250)
        }}
      >
        <For each={props.todos}>
          {(todo) => (
            <Checkbox
              readOnly
              checked={todo.status === "completed"}
              indeterminate={todo.status === "in_progress"}
              data-in-progress={todo.status === "in_progress" ? "" : undefined}
              icon={dot(todo.status)}
            >
              <span
                data-slot="session-todo-content"
                data-state={todo.status === "completed" || todo.status === "cancelled" ? "muted" : "active"}
              >
                {todo.content}
              </span>
            </Checkbox>
          )}
        </For>
      </div>
      <div data-slot="session-todo-scroll-fade" data-stuck={stuck()} />
    </div>
  )
}
