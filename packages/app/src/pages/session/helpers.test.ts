import { describe, expect, test } from "bun:test"
import {
  createOpenReviewFile,
  createOpenSessionFileTab,
  createReferenceSessionFile,
  focusSessionPromptDock,
  focusTerminalById,
  getTabReorderIndex,
} from "./helpers"

describe("createOpenReviewFile", () => {
  test("opens and loads selected review file", () => {
    const calls: string[] = []
    const openReviewFile = createOpenReviewFile({
      showAllFiles: () => calls.push("show"),
      tabForPath: (path) => {
        calls.push(`tab:${path}`)
        return `file://${path}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      loadFile: (path) => calls.push(`load:${path}`),
    })

    openReviewFile("src/a.ts")

    expect(calls).toEqual(["show", "tab:src/a.ts", "open:file://src/a.ts", "load:src/a.ts"])
  })
})

describe("createOpenSessionFileTab", () => {
  test("activates the opened file tab", () => {
    const calls: string[] = []
    const openTab = createOpenSessionFileTab({
      normalizeTab: (value) => {
        calls.push(`normalize:${value}`)
        return `file://${value}`
      },
      openTab: (tab) => calls.push(`open:${tab}`),
      pathFromTab: (tab) => {
        calls.push(`path:${tab}`)
        return tab.slice("file://".length)
      },
      loadFile: (path) => calls.push(`load:${path}`),
      openReviewPanel: () => calls.push("review"),
      setActive: (tab) => calls.push(`active:${tab}`),
    })

    openTab("src/a.ts")

    expect(calls).toEqual([
      "normalize:src/a.ts",
      "open:file://src/a.ts",
      "path:file://src/a.ts",
      "load:src/a.ts",
      "review",
      "active:file://src/a.ts",
    ])
  })
})

describe("focusSessionPromptDock", () => {
  test("focuses the prompt input in the session dock", () => {
    document.body.innerHTML = `<div data-component="session-prompt-dock"><textarea></textarea></div>`

    const focused = focusSessionPromptDock()

    expect(focused).toBe(true)
    expect(document.activeElement?.tagName).toBe("TEXTAREA")
  })

  test("prefers the chat input over prompt action buttons", () => {
    document.body.innerHTML = `
      <div data-component="session-prompt-dock">
        <button type="button">Attach</button>
        <div data-testid="session-prompt-input" contenteditable="true"></div>
      </div>
    `

    const focused = focusSessionPromptDock()

    expect(focused).toBe(true)
    expect(document.activeElement?.getAttribute("data-testid")).toBe("session-prompt-input")
  })
})

describe("createReferenceSessionFile", () => {
  test("adds file context and focuses the prompt dock", () => {
    const calls: string[] = []
    const reference = createReferenceSessionFile({
      addFileContext: (path) => calls.push(`file:${path}`),
      focusPromptDock: () => {
        calls.push("focus")
        return true
      },
    })

    reference("/tmp/成果报告.md")

    expect(calls).toEqual(["file:/tmp/成果报告.md", "focus"])
  })
})

describe("focusTerminalById", () => {
  test("focuses textarea when present", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-one"><div data-component="terminal"><textarea></textarea></div></div>`

    const focused = focusTerminalById("one")

    expect(focused).toBe(true)
    expect(document.activeElement?.tagName).toBe("TEXTAREA")
  })

  test("falls back to terminal element focus", () => {
    document.body.innerHTML = `<div id="terminal-wrapper-two"><div data-component="terminal" tabindex="0"></div></div>`
    const terminal = document.querySelector('[data-component="terminal"]') as HTMLElement
    let pointerDown = false
    terminal.addEventListener("pointerdown", () => {
      pointerDown = true
    })

    const focused = focusTerminalById("two")

    expect(focused).toBe(true)
    expect(document.activeElement).toBe(terminal)
    expect(pointerDown).toBe(true)
  })
})

describe("getTabReorderIndex", () => {
  test("returns target index for valid drag reorder", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "c")).toBe(2)
  })

  test("returns undefined for unknown droppable id", () => {
    expect(getTabReorderIndex(["a", "b", "c"], "a", "missing")).toBeUndefined()
  })
})
