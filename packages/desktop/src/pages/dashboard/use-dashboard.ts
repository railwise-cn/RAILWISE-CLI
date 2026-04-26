import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useEvents, usePlatform, useServer } from "@railwise/app"
import type { ActiveAgent, Alert, DashboardSummary, ProjectCard, SessionBrief } from "../../components/dashboard/types"

const PollMs = 5_000
const CacheKey = "rw_dashboard_cache"

type State = {
  projects: ProjectCard[]
  alerts: Alert[]
  recentSessions: SessionBrief[]
  activeAgents: ActiveAgent[]
  loading: boolean
  offline: boolean
}

function auth(server: NonNullable<ReturnType<typeof useServer>["current"]>) {
  if (!server.http.password) return {}
  return {
    Authorization: `Basic ${btoa(`${server.http.username ?? "railwise"}:${server.http.password}`)}`,
  }
}

function cache() {
  try {
    const value = localStorage.getItem(CacheKey)
    if (!value) return
    return JSON.parse(value) as DashboardSummary
  } catch {
    return
  }
}

export function useDashboard() {
  const server = useServer()
  const events = useEvents()
  const platform = usePlatform()
  const cached = cache()
  const [state, setState] = createStore<State>({
    projects: cached?.projects ?? [],
    alerts: cached?.alerts ?? [],
    recentSessions: cached?.recentSessions ?? [],
    activeAgents: cached?.activeAgents ?? [],
    loading: !cached,
    offline: false,
  })

  async function refresh(incremental = false) {
    if (!server.current) return
    const headers = new Headers(incremental ? { "Cache-Control": "no-cache" } : undefined)
    Object.entries(auth(server.current)).forEach(([key, value]) => headers.set(key, value))
    await (platform.fetch ?? globalThis.fetch)(`${server.current.http.url}/dashboard/summary`, { headers })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const data = (await response.json()) as DashboardSummary
        setState({ ...data, loading: false, offline: false })
        localStorage.setItem(CacheKey, JSON.stringify(data))
      })
      .catch(() => {
        setState("loading", false)
        setState("offline", true)
      })
  }

  void refresh()
  const timer = setInterval(() => refresh(true), PollMs)
  onCleanup(() => clearInterval(timer))

  createEffect(() => {
    const event = events.lastEvent
    if (!event) return
    if (event.type.startsWith("project.") || event.type.startsWith("agent.") || event.type.startsWith("session.")) {
      void refresh(true)
    }
  })

  return state
}
