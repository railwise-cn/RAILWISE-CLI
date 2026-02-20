export const deepLinkEvent = "railwise:deep-link"

export const parseDeepLink = (input: string) => {
  if (!input.startsWith("railwise://")) return
  if (typeof URL.canParse === "function" && !URL.canParse(input)) return
  const url = (() => {
    try {
      return new URL(input)
    } catch {
      return undefined
    }
  })()
  if (!url) return
  if (url.hostname !== "open-project") return
  const directory = url.searchParams.get("directory")
  if (!directory) return
  return directory
}

export const collectOpenProjectDeepLinks = (urls: string[]) =>
  urls.map(parseDeepLink).filter((directory): directory is string => !!directory)

type RAILWISE (甬算)Window = Window & {
  __RAILWISE__?: {
    deepLinks?: string[]
  }
}

export const drainPendingDeepLinks = (target: RAILWISE (甬算)Window) => {
  const pending = target.__RAILWISE__?.deepLinks ?? []
  if (pending.length === 0) return []
  if (target.__RAILWISE__) target.__RAILWISE__.deepLinks = []
  return pending
}
