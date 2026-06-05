import { type Session } from "@railwise/sdk/v2/client"

export const workspaceKey = (directory: string) => {
  const drive = directory.match(/^([A-Za-z]:)[\\/]+$/)
  if (drive) return `${drive[1]}${directory.includes("\\") ? "\\" : "/"}`
  if (/^[\\/]+$/.test(directory)) return directory.includes("\\") ? "\\" : "/"
  return directory.replace(/[\\/]+$/, "")
}

export function sortSessions(now: number) {
  const oneMinuteAgo = now - 60 * 1000
  return (a: Session, b: Session) => {
    const aUpdated = a.time.updated ?? a.time.created
    const bUpdated = b.time.updated ?? b.time.created
    const aRecent = aUpdated > oneMinuteAgo
    const bRecent = bUpdated > oneMinuteAgo
    if (aRecent && bRecent) return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    if (aRecent && !bRecent) return -1
    if (!aRecent && bRecent) return 1
    return bUpdated - aUpdated
  }
}

export const isRootVisibleSession = (session: Session, directory: string) =>
  workspaceKey(session.directory) === workspaceKey(directory) && !session.parentID && !session.time?.archived

export const sortedRootSessions = (store: { session: Session[]; path: { directory: string } }, now: number) =>
  store.session.filter((session) => isRootVisibleSession(session, store.path.directory)).sort(sortSessions(now))

export const childMapByParent = (sessions: Session[]) => {
  const map = new Map<string, string[]>()
  for (const session of sessions) {
    if (!session.parentID) continue
    const existing = map.get(session.parentID)
    if (existing) {
      existing.push(session.id)
      continue
    }
    map.set(session.parentID, [session.id])
  }
  return map
}

export function getDraggableId(event: unknown): string | undefined {
  if (typeof event !== "object" || event === null) return undefined
  if (!("draggable" in event)) return undefined
  const draggable = (event as { draggable?: { id?: unknown } }).draggable
  if (!draggable) return undefined
  return typeof draggable.id === "string" ? draggable.id : undefined
}

export function projectName(value: string) {
  const clean = workspaceKey(value).replaceAll("\\", "/")
  const parts = clean.split("/").filter(Boolean)
  return parts.at(-1) ?? "打开项目"
}

export function projectParent(value: string) {
  const clean = workspaceKey(value).replaceAll("\\", "/")
  const parts = clean.split("/").filter(Boolean)
  return parts.at(-2) ?? ""
}

export const duplicateProjectNames = (projects: { worktree: string }[]) => {
  const counts = new Map<string, number>()
  projects.forEach((project) => counts.set(projectName(project.worktree), (counts.get(projectName(project.worktree)) ?? 0) + 1))
  return new Set([...counts].filter((entry) => entry[1] > 1).map((entry) => entry[0]))
}

export function displayName(project: { name?: string; worktree: string }, projects?: { worktree: string }[]) {
  const label = project.name?.trim()
  if (label) return label

  const name = projectName(project.worktree)
  const parent = projectParent(project.worktree)
  if (!projects || !duplicateProjectNames(projects).has(name) || !parent) return name
  return `${name} (${parent})`
}

export const errorMessage = (err: unknown, fallback: string) => {
  if (err && typeof err === "object" && "data" in err) {
    const data = (err as { data?: { message?: string } }).data
    if (data?.message) return data.message
  }
  if (err instanceof Error) return err.message
  return fallback
}

export const syncWorkspaceOrder = (local: string, dirs: string[], existing?: string[]) => {
  if (!existing) return dirs
  const keep = existing.filter((d) => d !== local && dirs.includes(d))
  const missing = dirs.filter((d) => d !== local && !existing.includes(d))
  return [local, ...missing, ...keep]
}
