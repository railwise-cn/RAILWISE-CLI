import "./workspace.css"
import { A } from "@solidjs/router"
import { usePlatform, useServer } from "@railwise/app"
import { convertFileSrc } from "@tauri-apps/api/core"
import { createMemo, For, Match, onCleanup, onMount, Show, Switch } from "solid-js"
import { createStore } from "solid-js/store"
import { VList } from "virtua/solid"
import { sendToAgent as send } from "../../actions/sendToAgent"
import { commands, type DxfDocument, type DxfEntity, type OfficeImage } from "../../bindings"
import { parseCsv } from "./csv"
import type { FileKind, Preview, TableData, WorkspaceFile } from "./types"

const CacheKey = "rw_workspace_recent"

const labels: Record<FileKind, string> = {
  csv: "CSV",
  xlsx: "XLSX",
  dxf: "DXF",
  dwg: "DWG",
  pptx: "PPTX",
  docx: "DOCX",
  pdf: "PDF",
  markdown: "MD",
  unknown: "FILE",
}

type State = {
  files: WorkspaceFile[]
  tabs: string[]
  selected?: string
  query: string
  preview: Preview
  sending: boolean
  sendStatus?: string
  menu?: {
    x: number
    y: number
    file: string
  }
}

export default function WorkspacePage() {
  const platform = usePlatform()
  const server = useServer()
  const recent = stored()
  const [state, setState] = createStore<State>({
    files: recent,
    tabs: recent.slice(0, 6).map((file) => file.id),
    selected: recent[0]?.id,
    query: "",
    preview: { loading: false },
    sending: false,
  })
  const selected = createMemo(() => state.files.find((file) => file.id === state.selected))
  const tabs = createMemo(() =>
    state.tabs
      .map((id) => state.files.find((file) => file.id === id))
      .filter((file): file is WorkspaceFile => Boolean(file)),
  )
  const filtered = createMemo(() => {
    const query = state.query.trim().toLowerCase()
    if (!query) return state.files
    return state.files.filter((file) => `${file.name} ${file.path} ${labels[file.kind]}`.toLowerCase().includes(query))
  })
  const groups = createMemo(() => {
    const map = new Map<string, WorkspaceFile[]>()
    filtered().forEach((file) => map.set(project(file.path), [...(map.get(project(file.path)) ?? []), file]))
    return Array.from(map.entries()).map(([name, files]) => ({ name, files }))
  })

  async function openFiles() {
    if (!platform.openFilePickerDialog) {
      setState("preview", { loading: false, error: "当前平台没有文件选择能力。" })
      return
    }

    const result = await platform.openFilePickerDialog({
      title: "打开工程数据文件",
      multiple: true,
    })
    const paths = Array.isArray(result) ? result : result ? [result] : []
    const files = paths.map(file).filter((item) => item.kind !== "unknown")
    if (files.length === 0) return

    const merged = [
      ...files,
      ...state.files.filter((current) => !files.some((item) => item.path === current.path)),
    ].slice(0, 80)
    setState("files", merged)
    localStorage.setItem(CacheKey, JSON.stringify(merged))
    await select(files[0])
  }

  async function select(file: WorkspaceFile) {
    setState({
      selected: file.id,
      sendStatus: undefined,
      menu: undefined,
    })
    setState("tabs", (tabs) => [file.id, ...tabs.filter((id) => id !== file.id)].slice(0, 6))
    setState("preview", { loading: true })

    const preview = await load(file).catch((error) => ({
      loading: false,
      error: error instanceof Error ? error.message : String(error),
    }))
    setState("preview", preview)
  }

  function closeTab(file: WorkspaceFile) {
    const next = state.tabs.filter((id) => id !== file.id)
    setState("tabs", next)
    if (file.id !== state.selected) return
    const target = state.files.find((item) => item.id === next[0])
    if (target) {
      void select(target)
      return
    }
    setState({
      selected: undefined,
      preview: { loading: false },
    })
  }

  async function sendToAgent(target?: WorkspaceFile, role: "data" | "review" | "cad" = "data") {
    const file = target ?? selected()
    if (!file) return

    setState({ sending: true, sendStatus: undefined, menu: undefined })
    const agent = {
      data: "工程数据分析 Agent",
      review: "成果审查 Agent",
      cad: "CAD 图纸审查 Agent",
    }[role]
    const prompt = [
      `请作为 Railwise ${agent} 处理这个文件。`,
      `文件：${file.path}`,
      `类型：${labels[file.kind]}`,
      "请先识别数据结构、关键字段、异常值和下一步可自动化处理建议。",
    ].join("\n")
    setState({
      sending: false,
      sendStatus: await send({
        platform,
        server: server.current,
        title: `分析 ${file.name}`,
        prompt,
      }),
    })
  }

  function openNative(target?: WorkspaceFile) {
    const file = target ?? selected()
    if (!file) return
    setState("menu", undefined)
    void platform.openPath?.(file.path)
  }

  onMount(() => {
    const close = () => setState("menu", undefined)
    document.addEventListener("click", close)
    onCleanup(() => document.removeEventListener("click", close))

    const file = selected()
    if (file) void select(file)
  })

  return (
    <main class="rw-workspace" data-testid="workspace-container">
      <aside class="workspace-sidebar">
        <div>
          <p class="workspace-muted">/workspace</p>
          <h2>数据工作区</h2>
        </div>
        <div class="workspace-actions">
          <button type="button" data-testid="open-files-btn" onClick={openFiles}>
            打开文件
          </button>
          <A class="workspace-open-link" href="/workspace/diff">
            版本对比
          </A>
          <A class="workspace-open-link" href="/dashboard">
            驾驶舱
          </A>
        </div>
        <div class="workspace-search">
          <label for="workspace-search">搜索最近文件</label>
          <input
            id="workspace-search"
            value={state.query}
            onInput={(event) => setState("query", event.currentTarget.value)}
            placeholder="文件名、路径或类型"
          />
        </div>
        <div class="workspace-files" data-testid="workspace-file-list">
          <Show when={groups().length > 0} fallback={<p class="workspace-muted">暂无最近文件。点击“打开文件”导入 CSV、XLSX、DXF、DWG、PPTX、DOCX、PDF 或 Markdown。</p>}>
            <For each={groups()}>
              {(group) => (
                <section class="workspace-file-group">
                  <h3>{group.name}</h3>
                  <For each={group.files}>
                    {(item) => (
                      <button
                        type="button"
                        class="workspace-file"
                        data-testid="workspace-file-item"
                        data-active={item.id === state.selected}
                        onClick={() => select(item)}
                        onContextMenu={(event) => {
                          event.preventDefault()
                          setState("menu", { x: event.clientX, y: event.clientY, file: item.id })
                        }}
                      >
                        <strong>{item.name}</strong>
                        <span class="workspace-chip">{labels[item.kind]}</span>
                        <span>{item.path}</span>
                      </button>
                    )}
                  </For>
                </section>
              )}
            </For>
          </Show>
        </div>
        <ContextMenu
          file={state.files.find((file) => file.id === state.menu?.file)}
          x={state.menu?.x}
          y={state.menu?.y}
          onOpen={openNative}
          onSend={sendToAgent}
        />
      </aside>

      <section class="workspace-main">
        <header class="workspace-head">
          <div>
            <p>工程文件预览、转换与 Agent 分发</p>
            <h1>{selected()?.name ?? "Railwise Data Workspace"}</h1>
          </div>
          <div class="workspace-actions">
            <button type="button" data-testid="open-native-btn" onClick={() => openNative()} disabled={!selected()}>
              系统打开
            </button>
            <button type="button" data-testid="send-to-agent-btn" onClick={() => sendToAgent()} disabled={!selected() || state.sending}>
              {state.sending ? "发送中" : "发送到 Agent"}
            </button>
          </div>
        </header>
        <TabBar files={tabs()} selected={state.selected} onSelect={select} onClose={closeTab} />
        <PreviewPane file={selected()} preview={state.preview} />
      </section>

      <aside class="workspace-inspector">
        <section class="workspace-panel">
          <div class="workspace-panel__head">
            <h2>文件属性</h2>
            <span>{selected() ? labels[selected()!.kind] : "未选择"}</span>
          </div>
          <Inspector file={selected()} preview={state.preview} />
        </section>
        <section class="workspace-panel">
          <div class="workspace-panel__head">
            <h2>操作状态</h2>
          </div>
          <p class="workspace-muted">{state.sendStatus ?? "可将当前文件交给 Agent 生成结构识别和处理建议。"}</p>
        </section>
      </aside>
    </main>
  )
}

async function load(file: WorkspaceFile): Promise<Preview> {
  if (file.kind === "csv") {
    return {
      loading: false,
      table: parseCsv(await commands.readTextFile(file.path)),
    }
  }

  if (file.kind === "xlsx") {
    return {
      loading: false,
      table: parseCsv(await commands.convertSheetToCsv(file.path)),
    }
  }

  if (file.kind === "dxf") {
    return {
      loading: false,
      dxf: await commands.parseDxf(file.path),
    }
  }

  if (file.kind === "dwg") {
    return {
      loading: false,
      dxf: await commands.parseDxf(await commands.convertDwgToDxf(file.path)),
    }
  }

  if (file.kind === "pptx") {
    return {
      loading: false,
      images: await commands.convertPptxToImages(file.path),
    }
  }

  if (file.kind === "docx") {
    return {
      loading: false,
      html: await commands.convertDocxToHtml(file.path),
    }
  }

  if (file.kind === "markdown") {
    const markdown = await commands.readTextFile(file.path)
    return {
      loading: false,
      html: await commands.parseMarkdownCommand(markdown),
    }
  }

  if (file.kind === "pdf") {
    return {
      loading: false,
      pdf: file.path,
    }
  }

  return { loading: false, error: "暂不支持该文件类型。" }
}

function TabBar(props: {
  files: WorkspaceFile[]
  selected?: string
  onSelect: (file: WorkspaceFile) => void
  onClose: (file: WorkspaceFile) => void
}) {
  return (
    <div class="workspace-tabs" data-testid="workspace-tabbar">
      <Show when={props.files.length > 0} fallback={<span class="workspace-muted">最多同时打开 6 个工程文件。</span>}>
        <For each={props.files}>
          {(file) => (
            <div class="workspace-tab" data-active={file.id === props.selected}>
              <button type="button" onClick={() => props.onSelect(file)}>
                <span>{file.name}</span>
                <span>{labels[file.kind]}</span>
              </button>
              <button type="button" aria-label={`关闭 ${file.name}`} onClick={() => props.onClose(file)}>
                ×
              </button>
            </div>
          )}
        </For>
      </Show>
    </div>
  )
}

function ContextMenu(props: {
  file?: WorkspaceFile
  x?: number
  y?: number
  onOpen: (file: WorkspaceFile) => void
  onSend: (file: WorkspaceFile, role?: "data" | "review" | "cad") => void
}) {
  return (
    <Show when={props.file && props.x !== undefined && props.y !== undefined ? props.file : undefined}>
      {(file) => (
        <div class="workspace-context" style={{ left: `${props.x}px`, top: `${props.y}px` }} onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => props.onOpen(file())}>
            系统打开
          </button>
          <button type="button" onClick={() => props.onSend(file())}>
            发送到数据分析 Agent
          </button>
          <button type="button" onClick={() => props.onSend(file(), "review")}>
            发送到成果审查 Agent
          </button>
          <button type="button" onClick={() => props.onSend(file(), "cad")}>
            发送到 CAD 图纸审查 Agent
          </button>
          <A href="/workspace/diff">进入版本对比</A>
        </div>
      )}
    </Show>
  )
}

function PreviewPane(props: { file?: WorkspaceFile; preview: Preview }) {
  return (
    <section class="workspace-preview">
      <Show when={props.file} fallback={<div class="workspace-preview__empty">选择或打开一个工程文件开始预览。</div>}>
        {(file) => (
          <Switch>
            <Match when={props.preview.loading}>
              <div class="workspace-preview__loading">正在解析 {file().name}</div>
            </Match>
            <Match when={props.preview.error}>
              {(error) => <div class="workspace-preview__error">{error()}</div>}
            </Match>
            <Match when={props.preview.table}>
              {(table) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">{table().rows.length} 行</span>
                  </div>
                  <TablePreview data={table()} />
                </div>
              )}
            </Match>
            <Match when={props.preview.dxf}>
              {(dxf) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">{dxf().entities.length} 图元</span>
                  </div>
                  <DxfPreview doc={dxf()} />
                </div>
              )}
            </Match>
            <Match when={props.preview.images}>
              {(images) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">{images().length} 页</span>
                  </div>
                  <PptxPreview images={images()} />
                </div>
              )}
            </Match>
            <Match when={props.preview.html}>
              {(html) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">HTML</span>
                  </div>
                  <div class="workspace-doc">
                    <article class="workspace-doc__html" innerHTML={html()} />
                  </div>
                </div>
              )}
            </Match>
            <Match when={props.preview.pdf}>
              {(path) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">PDF</span>
                  </div>
                  <iframe class="workspace-pdf" src={convertFileSrc(path())} title={file().name} />
                </div>
              )}
            </Match>
            <Match when={props.preview.text}>
              {(text) => (
                <div class="workspace-preview__body">
                  <div class="workspace-preview__title">
                    <h2>{file().name}</h2>
                    <span class="workspace-chip">TEXT</span>
                  </div>
                  <div class="workspace-doc">
                    <pre>{text()}</pre>
                  </div>
                </div>
              )}
            </Match>
          </Switch>
        )}
      </Show>
    </section>
  )
}

function TablePreview(props: { data: TableData }) {
  const [state, setState] = createStore({
    filter: "",
    sort: undefined as { column: number; desc: boolean } | undefined,
  })
  const rows = createMemo(() => {
    const filter = state.filter.trim().toLowerCase()
    const data = filter
      ? props.data.rows.filter((row) => row.join(" ").toLowerCase().includes(filter))
      : props.data.rows
    if (!state.sort) return data
    return [...data].sort((a, b) => {
      const left = a[state.sort!.column] ?? ""
      const right = b[state.sort!.column] ?? ""
      return state.sort!.desc ? right.localeCompare(left, "zh-CN") : left.localeCompare(right, "zh-CN")
    })
  })
  const template = createMemo(() => `repeat(${props.data.columns.length}, minmax(140px, 1fr))`)

  function sort(column: number) {
    setState("sort", (current) => ({
      column,
      desc: current?.column === column ? !current.desc : false,
    }))
  }

  return (
    <div class="workspace-table-wrap" data-testid="csv-preview-table">
      <div class="workspace-toolbar">
        <input
          class="workspace-filter"
          value={state.filter}
          onInput={(event) => setState("filter", event.currentTarget.value)}
          placeholder="过滤表格内容"
        />
        <span class="workspace-muted">首列已冻结，点击列头排序。</span>
      </div>
      <div style={{ overflow: "auto", "min-height": "0" }}>
        <div class="workspace-table-head" style={{ "grid-template-columns": template() }}>
          <For each={props.data.columns}>
            {(column, index) => (
              <button type="button" class="workspace-cell" onClick={() => sort(index())}>
                {column}
                <Show when={state.sort?.column === index()}>{state.sort?.desc ? " ↓" : " ↑"}</Show>
              </button>
            )}
          </For>
        </div>
        <VList data={rows()} style={{ height: "520px" }}>
          {(row) => (
            <div class="workspace-row" style={{ "grid-template-columns": template() }}>
              <For each={row}>{(cell) => <span class="workspace-cell">{cell}</span>}</For>
            </div>
          )}
        </VList>
      </div>
    </div>
  )
}

function DxfPreview(props: { doc: DxfDocument }) {
  const [state, setState] = createStore({
    hidden: [] as string[],
    zoom: 1,
    panX: 0,
    panY: 0,
  })
  const box = createMemo(() => {
    const width = Math.max(props.doc.bounds.maxX - props.doc.bounds.minX, 1)
    const height = Math.max(props.doc.bounds.maxY - props.doc.bounds.minY, 1)
    const viewWidth = width / state.zoom
    const viewHeight = height / state.zoom
    return {
      width,
      height,
      value: `${props.doc.bounds.minX + (width - viewWidth) / 2 + state.panX} ${props.doc.bounds.minY + (height - viewHeight) / 2 + state.panY} ${viewWidth} ${viewHeight}`,
    }
  })
  const visible = (layer: string) => !state.hidden.includes(layer)
  let drag: { x: number; y: number; panX: number; panY: number } | undefined

  function toggle(layer: string) {
    setState("hidden", (hidden) =>
      hidden.includes(layer) ? hidden.filter((item) => item !== layer) : [...hidden, layer],
    )
  }

  function move(event: PointerEvent) {
    if (!drag) return
    setState({
      panX: drag.panX - ((event.clientX - drag.x) / 600) * (box().width / state.zoom),
      panY: drag.panY - ((event.clientY - drag.y) / 520) * (box().height / state.zoom),
    })
  }

  return (
    <div class="workspace-dxf-wrap" data-testid="workspace-dxf-preview">
      <div class="workspace-layers" data-testid="layer-panel">
        <div class="workspace-toolbar">
          <button type="button" onClick={() => setState("zoom", Math.min(state.zoom * 1.25, 100))}>
            放大
          </button>
          <button type="button" onClick={() => setState("zoom", Math.max(state.zoom / 1.25, 0.1))}>
            缩小
          </button>
        </div>
        <For each={props.doc.layers}>
          {(layer) => (
            <label class="workspace-layer" data-testid="layer-item" data-visible={visible(layer.name)}>
              <span>{layer.name}</span>
              <input data-testid="layer-toggle" type="checkbox" checked={visible(layer.name)} onChange={() => toggle(layer.name)} />
            </label>
          )}
        </For>
      </div>
      <div class="workspace-dxf-canvas" data-testid="dxf-canvas">
        <svg
          viewBox={box().value}
          onPointerDown={(event) => {
            drag = { x: event.clientX, y: event.clientY, panX: state.panX, panY: state.panY }
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerMove={move}
          onPointerUp={() => {
            drag = undefined
          }}
        >
          <For each={props.doc.entities}>{(entity) => renderDxf(entity, visible)}</For>
        </svg>
      </div>
    </div>
  )
}

function renderDxf(entity: DxfEntity, visible: (layer: string) => boolean) {
  if (!visible(entity.layer)) return null
  const stroke = aci(entity.color)

  if (entity.kind === "line") {
    return <line x1={entity.start.x} y1={entity.start.y} x2={entity.end.x} y2={entity.end.y} stroke={stroke} stroke-width="0.8" />
  }

  if (entity.kind === "circle") {
    return <circle cx={entity.center.x} cy={entity.center.y} r={entity.radius} fill="none" stroke={stroke} stroke-width="0.8" />
  }

  if (entity.kind === "arc") {
    return <path d={arc(entity)} fill="none" stroke={stroke} stroke-width="0.8" />
  }

  if (entity.kind === "polyline") {
    return (
      <polyline
        points={entity.points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={entity.closed ? `${stroke}22` : "none"}
        stroke={stroke}
        stroke-width="0.8"
      />
    )
  }

  return (
    <text x={entity.insert.x} y={entity.insert.y} fill={stroke} font-size={`${Math.max(entity.height, 1)}`}>
      {entity.value}
    </text>
  )
}

function arc(entity: Extract<DxfEntity, { kind: "arc" }>) {
  const start = polar(entity.center.x, entity.center.y, entity.radius, entity.startAngle)
  const end = polar(entity.center.x, entity.center.y, entity.radius, entity.endAngle)
  const diff = Math.abs(entity.endAngle - entity.startAngle)
  return `M ${start.x} ${start.y} A ${entity.radius} ${entity.radius} 0 ${diff > 180 ? 1 : 0} 1 ${end.x} ${end.y}`
}

function polar(x: number, y: number, radius: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: x + Math.cos(rad) * radius,
    y: y + Math.sin(rad) * radius,
  }
}

function Inspector(props: { file?: WorkspaceFile; preview: Preview }) {
  return (
    <Show when={props.file} fallback={<p class="workspace-muted">尚未选择文件。</p>}>
      {(file) => (
        <>
          <div class="workspace-stat">
            <span>名称</span>
            <strong>{file().name}</strong>
          </div>
          <div class="workspace-stat">
            <span>类型</span>
            <strong>{labels[file().kind]}</strong>
          </div>
          <div class="workspace-stat">
            <span>路径</span>
            <strong>{file().path}</strong>
          </div>
          <Show when={props.preview.table}>
            {(table) => (
              <>
                <div class="workspace-stat">
                  <span>列数</span>
                  <strong>{table().columns.length}</strong>
                </div>
                <div class="workspace-stat">
                  <span>行数</span>
                  <strong>{table().rows.length}</strong>
                </div>
              </>
            )}
          </Show>
          <Show when={props.preview.dxf}>
            {(dxf) => (
              <>
                <div class="workspace-stat">
                  <span>图层</span>
                  <strong>{dxf().layers.length}</strong>
                </div>
                <div class="workspace-stat">
                  <span>图元</span>
                  <strong>{dxf().entities.length}</strong>
                </div>
              </>
            )}
          </Show>
        </>
      )}
    </Show>
  )
}

function PptxPreview(props: { images: OfficeImage[] }) {
  const [state, setState] = createStore({
    selected: props.images[0]?.path,
  })
  const selected = createMemo(() => props.images.find((image) => image.path === state.selected) ?? props.images[0])

  return (
    <div class="workspace-pptx">
      <Show when={selected()}>
        {(image) => <img class="workspace-slide-main" src={convertFileSrc(image().path)} alt={image().name} />}
      </Show>
      <div class="workspace-slides">
        <For each={props.images}>
          {(image) => (
            <button type="button" class="workspace-slide" data-active={image.path === state.selected} onClick={() => setState("selected", image.path)}>
              <img src={convertFileSrc(image.path)} alt={image.name} />
              <span>{image.name}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  )
}

function file(path: string): WorkspaceFile {
  const name = path.split(/[\\/]/).pop() || path
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return {
    id: path,
    path,
    name,
    kind: kind(ext),
  }
}

function project(path: string) {
  const parts = path.split(/[\\/]/).filter(Boolean)
  if (parts.length < 2) return "未归档项目"
  return parts.at(-2) ?? "未归档项目"
}

function kind(ext: string): FileKind {
  if (ext === "csv") return "csv"
  if (ext === "xlsx" || ext === "xls") return "xlsx"
  if (ext === "dxf") return "dxf"
  if (ext === "dwg") return "dwg"
  if (ext === "pptx") return "pptx"
  if (ext === "docx") return "docx"
  if (ext === "pdf") return "pdf"
  if (ext === "md" || ext === "markdown") return "markdown"
  return "unknown"
}

function aci(color: number) {
  const palette = ["#d9d9d9", "#d9363e", "#d48806", "#d4b106", "#389e0d", "#08979c", "#1d39c4", "#722ed1", "#ad4e00"]
  return palette[Math.abs(color) % palette.length] ?? "#262626"
}

function stored() {
  try {
    const value = localStorage.getItem(CacheKey)
    if (!value) return []
    return JSON.parse(value) as WorkspaceFile[]
  } catch {
    return []
  }
}
