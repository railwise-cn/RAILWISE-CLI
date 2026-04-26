import loader from "@monaco-editor/loader"
import * as monaco from "monaco-editor"
import type { editor } from "monaco-editor"
import "monaco-editor/min/vs/editor/editor.main.css"
import { createEffect, createSignal, onCleanup, onMount } from "solid-js"

export function AgentEditor(props: {
  value: string
  onChange: (value: string) => void
}) {
  let root: HTMLDivElement | undefined
  let instance: editor.IStandaloneCodeEditor | undefined
  const [ready, setReady] = createSignal(false)

  onMount(async () => {
    loader.config({ monaco })
    const api = await loader.init()
    if (!root) return
    const editor = api.editor.create(root, {
      value: props.value,
      language: "markdown",
      theme: "vs",
      minimap: { enabled: false },
      automaticLayout: true,
      fontFamily: "var(--font-family, ui-monospace)",
      fontSize: 13,
      lineNumbersMinChars: 3,
      lineDecorationsWidth: 10,
      padding: { top: 14, bottom: 14 },
      scrollBeyondLastLine: false,
      wordWrap: "on",
    })
    instance = editor
    editor.onDidChangeModelContent(() => props.onChange(editor.getValue()))
    setReady(true)
  })

  createEffect(() => {
    const value = props.value
    if (!instance || instance.getValue() === value) return
    instance.setValue(value)
  })

  onCleanup(() => instance?.dispose())

  return (
    <div class="agent-editor" data-testid="agent-prompt-editor">
      <div ref={root} class="agent-editor__root" />
      <div classList={{ "agent-editor__loading": true, hidden: ready() }}>加载编辑器</div>
    </div>
  )
}
