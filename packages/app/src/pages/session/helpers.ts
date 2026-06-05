import { batch } from "solid-js"

export const focusTerminalById = (id: string) => {
  const wrapper = document.getElementById(`terminal-wrapper-${id}`)
  const terminal = wrapper?.querySelector('[data-component="terminal"]')
  if (!(terminal instanceof HTMLElement)) return false

  const textarea = terminal.querySelector("textarea")
  if (textarea instanceof HTMLTextAreaElement) {
    textarea.focus()
    return true
  }

  terminal.focus()
  terminal.dispatchEvent(
    typeof PointerEvent === "function"
      ? new PointerEvent("pointerdown", { bubbles: true, cancelable: true })
      : new MouseEvent("pointerdown", { bubbles: true, cancelable: true }),
  )
  return true
}

export const createOpenReviewFile = (input: {
  showAllFiles: () => void
  tabForPath: (path: string) => string
  openTab: (tab: string) => void
  loadFile: (path: string) => void
}) => {
  return (path: string) => {
    batch(() => {
      input.showAllFiles()
      input.openTab(input.tabForPath(path))
      input.loadFile(path)
    })
  }
}

export const createOpenSessionFileTab = (input: {
  normalizeTab: (tab: string) => string
  openTab: (tab: string) => void
  pathFromTab: (tab: string) => string | undefined
  loadFile: (path: string) => void
  openReviewPanel: () => void
  setActive: (tab: string) => void
}) => {
  return (value: string) => {
    const next = input.normalizeTab(value)
    input.openTab(next)

    const path = input.pathFromTab(next)
    if (!path) return

    input.loadFile(path)
    input.openReviewPanel()
    input.setActive(next)
  }
}

export const focusSessionPromptDock = () => {
  const dock = document.querySelector('[data-component="session-prompt-dock"]')
  if (!(dock instanceof HTMLElement)) return false
  dock.scrollIntoView({ block: "center", behavior: "smooth" })
  const target = [
    '[data-testid="session-prompt-input"]',
    '[data-component="prompt-input"][contenteditable="true"]',
    'textarea:not([disabled])',
    '[contenteditable="true"]',
    'button:not([disabled])',
  ]
    .map((selector) => dock.querySelector(selector))
    .find((item): item is HTMLElement => item instanceof HTMLElement)
  if (!(target instanceof HTMLElement)) return false
  target.focus()
  return true
}

export const createReferenceSessionFile = (input: {
  addFileContext: (path: string) => void
  focusPromptDock: () => boolean
}) => {
  return (path: string) => {
    input.addFileContext(path)
    input.focusPromptDock()
  }
}

export const getTabReorderIndex = (tabs: readonly string[], from: string, to: string) => {
  const fromIndex = tabs.indexOf(from)
  const toIndex = tabs.indexOf(to)
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return undefined
  return toIndex
}
