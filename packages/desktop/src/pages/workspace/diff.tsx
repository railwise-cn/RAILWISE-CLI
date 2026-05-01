import "./workspace.css"
import { A } from "@solidjs/router"
import { usePlatform, useServer } from "@railwise/app"
import { createMemo, For, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { VList } from "virtua/solid"
import { sendToAgent } from "../../actions/sendToAgent"
import { commands } from "../../bindings"
import { parseCsv } from "./csv"

type Side = "left" | "right"
type Mode = "text" | "table" | "dxf"
type Row = {
  type: "same" | "added" | "removed" | "modified"
  left?: string
  right?: string
}

type State = {
  left?: string
  right?: string
  loading: boolean
  rows: Row[]
  mode: Mode
  error?: string
  sending: boolean
  sendStatus?: string
}

export default function WorkspaceDiffPage() {
  const platform = usePlatform()
  const server = useServer()
  const [state, setState] = createStore<State>({
    loading: false,
    rows: [],
    mode: "text",
    sending: false,
  })
  const stats = createMemo(() => ({
    added: state.rows.filter((row) => row.type === "added").length,
    removed: state.rows.filter((row) => row.type === "removed").length,
    modified: state.rows.filter((row) => row.type === "modified").length,
  }))

  async function choose(side: Side) {
    if (!platform.openFilePickerDialog) {
      setState("error", "当前平台没有文件选择能力。")
      return
    }

    const result = await platform.openFilePickerDialog({
      title: side === "left" ? "选择旧版本文件" : "选择新版本文件",
    })
    const path = Array.isArray(result) ? result[0] : result
    if (!path) return

    setState(side, path)
    const left = side === "left" ? path : state.left
    const right = side === "right" ? path : state.right
    if (left && right) await compare(left, right)
  }

  async function compare(left: string, right: string) {
    setState({
      loading: true,
      error: undefined,
      sendStatus: undefined,
      rows: [],
      mode: mode(left, right),
    })

    const result = await Promise.all([read(left), read(right)])
      .then(([a, b]) => lines(a, b))
      .catch((error) => {
        setState("error", error instanceof Error ? error.message : String(error))
        return []
      })

    setState({
      loading: false,
      rows: result,
    })
  }

  async function sendDiff() {
    if (!state.left || !state.right) return
    setState({ sending: true, sendStatus: undefined })
    setState({
      sending: false,
      sendStatus: await sendToAgent({
        platform,
        server: server.current,
        title: `对比 ${name(state.left)} / ${name(state.right)}`,
        prompt: [
          "请作为 Railwise 成果审查 Agent 对比两份工程文件。",
          `旧版本：${state.left}`,
          `新版本：${state.right}`,
          `新增：${stats().added} 行，删除：${stats().removed} 行，修改：${stats().modified} 行`,
          "请输出关键变化、风险点、可能影响的工程成果，以及需要人工复核的条目。",
        ].join("\n"),
      }),
    })
  }

  return (
    <main class="rw-workspace workspace-diff" data-testid="workspace-diff-container">
      <section class="workspace-main">
        <header class="workspace-head">
          <div>
            <p>/workspace/diff</p>
            <h1>版本对比</h1>
          </div>
          <div class="workspace-actions">
            <button type="button" onClick={() => choose("left")}>
              选择旧版本
            </button>
            <button type="button" onClick={() => choose("right")}>
              选择新版本
            </button>
            <button type="button" onClick={sendDiff} disabled={!state.left || !state.right || state.sending}>
              {state.sending ? "发送中" : "发送到 Agent"}
            </button>
            <A class="workspace-open-link" href="/workspace">
              返回工作区
            </A>
          </div>
        </header>

        <div class="workspace-diff-head">
          <FileBadge label="旧版本" path={state.left} tone="removed" />
          <FileBadge label="新版本" path={state.right} tone="added" />
          <div class="workspace-diff-stats">
            <span>新增 {stats().added}</span>
            <span>删除 {stats().removed}</span>
            <span>修改 {stats().modified}</span>
            <span>{state.mode.toUpperCase()}</span>
          </div>
        </div>

        <section class="workspace-preview">
          <Show when={!state.error} fallback={<div class="workspace-preview__error">{state.error}</div>}>
            <Show
              when={state.rows.length > 0}
              fallback={
                <div class="workspace-preview__empty">
                  {state.loading ? "正在生成差异..." : "选择两份 CSV、XLSX、DXF、Markdown、DOCX 或文本文件开始对比。"}
                </div>
              }
            >
              <div class="workspace-diff-table">
                <VList data={state.rows} style={{ height: "calc(100vh - 220px)" }}>
                  {(row) => (
                    <div class="workspace-diff-row" data-kind={row.type}>
                      <pre>{row.left ?? ""}</pre>
                      <pre>{row.right ?? ""}</pre>
                    </div>
                  )}
                </VList>
              </div>
            </Show>
          </Show>
        </section>

        <Show when={state.sendStatus}>
          {(status) => <div class="workspace-diff-status">{status()}</div>}
        </Show>
      </section>
    </main>
  )
}

function FileBadge(props: { label: string; path?: string; tone: "added" | "removed" }) {
  return (
    <div class="workspace-diff-badge" data-tone={props.tone}>
      <span>{props.label}</span>
      <strong>{props.path ? name(props.path) : "未选择"}</strong>
      <small>{props.path ?? "请选择文件"}</small>
    </div>
  )
}

async function read(path: string) {
  const ext = path.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "xlsx" || ext === "xls") return commands.convertSheetToCsv(path)
  if (ext === "dxf") return dxf(path)
  if (ext === "dwg") return dxf(await commands.convertDwgToDxf(path))
  if (ext === "docx") return strip(await commands.convertDocxToHtml(path))
  if (ext === "pptx") {
    const images = await commands.convertPptxToImages(path)
    return images.map((image) => image.name).join("\n")
  }
  if (ext === "csv") return tableText(await commands.readTextFile(path))
  return commands.readTextFile(path)
}

async function dxf(path: string) {
  const doc = await commands.parseDxf(path)
  return [
    `source: ${doc.sourcePath}`,
    `layers: ${doc.layers.map((layer) => layer.name).join(", ")}`,
    `entities: ${doc.entities.length}`,
    ...doc.entities.map((entity) => JSON.stringify(entity)),
  ].join("\n")
}

function tableText(input: string) {
  const table = parseCsv(input)
  return [table.columns.join(","), ...table.rows.map((row) => row.join(","))].join("\n")
}

function strip(input: string) {
  return input.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

function mode(left: string, right: string): Mode {
  const ext = [left, right].map((path) => path.split(".").pop()?.toLowerCase() ?? "")
  if (ext.some((value) => value === "dxf" || value === "dwg")) return "dxf"
  if (ext.some((value) => value === "csv" || value === "xlsx" || value === "xls")) return "table"
  return "text"
}

function lines(left: string, right: string): Row[] {
  const a = split(left)
  const b = split(right)
  if (a.length * b.length > 320_000) return aligned(a, b)

  const dp = Array.from({ length: a.length + 1 }, () => Array.from({ length: b.length + 1 }, () => 0))
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const rows: Row[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ type: "same", left: a[i], right: b[j] })
      i += 1
      j += 1
      continue
    }

    if (j < b.length && (i === a.length || dp[i][j + 1] >= dp[i + 1][j])) {
      const next = i < a.length && dp[i + 1]?.[j] === dp[i][j + 1]
      rows.push(next ? { type: "modified", left: a[i++], right: b[j++] } : { type: "added", right: b[j++] })
      continue
    }

    rows.push({ type: "removed", left: a[i++] })
  }

  return rows
}

function aligned(a: string[], b: string[]) {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, index) => {
    if (a[index] === b[index]) return { type: "same", left: a[index], right: b[index] } satisfies Row
    if (a[index] === undefined) return { type: "added", right: b[index] } satisfies Row
    if (b[index] === undefined) return { type: "removed", left: a[index] } satisfies Row
    return { type: "modified", left: a[index], right: b[index] } satisfies Row
  })
}

function split(input: string) {
  return input.replace(/\r\n/g, "\n").split("\n")
}

function name(path: string) {
  return path.split(/[\\/]/).pop() || path
}
