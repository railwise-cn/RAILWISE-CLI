type Callback = (data: unknown) => unknown
type StoreData = Map<string, unknown>
type InvokeArgs = Record<string, unknown>

type HarnessWindow = Window &
  typeof globalThis & {
    __RAILWISE__?: {
      browserHarness?: boolean
      updaterEnabled?: boolean
      deepLinks?: string[]
      wsl?: boolean
    }
    __TAURI_INTERNALS__?: {
      callbacks: Map<number, Callback>
      convertFileSrc: (path: string) => string
      invoke: (command: string, args?: InvokeArgs) => Promise<unknown>
      runCallback: (id: number, data: unknown) => void
      transformCallback: (callback?: Callback, once?: boolean) => number
      unregisterCallback: (id: number) => void
    }
    __TAURI_EVENT_PLUGIN_INTERNALS__?: { unregisterListener: () => void }
    __TAURI_OS_PLUGIN_INTERNALS__?: Record<string, string>
  }

const server = () =>
  `http://${import.meta.env.VITE_RAILWISE_SERVER_HOST ?? "127.0.0.1"}:${
    import.meta.env.VITE_RAILWISE_SERVER_PORT ?? "4096"
  }`

const osType = () => {
  if (typeof navigator !== "object") return "macos"
  if (/Win/.test(navigator.platform)) return "windows"
  return "macos"
}

const storeKey = (args: InvokeArgs) => (typeof args.path === "string" ? args.path : "default.dat")
const storeResource = (args: InvokeArgs) => Number(args.rid)

export function installDevBrowserHarness() {
  const win = window as HarnessWindow
  if (win.__TAURI_INTERNALS__) return

  const callbacks = new Map<number, Callback>()
  const stores = new Map<number, StoreData>()
  const paths = new Map<string, number>()
  let next = 1
  let resource = 1000

  const seed = (path: string, data = new Map<string, unknown>()) => {
    const rid = resource++
    paths.set(path, rid)
    stores.set(rid, data)
    return rid
  }
  const load = (path: string) => paths.get(path) ?? seed(path)
  const read = (args: InvokeArgs) => stores.get(storeResource(args))

  seed("railwise.global.dat", new Map([["language", JSON.stringify({ locale: "zh" })]]))

  win.__RAILWISE__ = {
    ...(win.__RAILWISE__ ?? {}),
    browserHarness: true,
    updaterEnabled: false,
  }
  const os = osType()
  win.__TAURI_OS_PLUGIN_INTERNALS__ = {
    arch: "x86_64",
    eol: "\n",
    exe_extension: os === "windows" ? ".exe" : "",
    family: os === "windows" ? "windows" : "unix",
    os_type: os,
    platform: os,
    version: "browser-preview",
  }
  win.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => undefined }
  win.__TAURI_INTERNALS__ = {
    callbacks,
    convertFileSrc: (path) => `asset://localhost/${encodeURIComponent(path)}`,
    invoke: async (command, args = {}) => {
      if (command === "await_initialization") {
        const event = args.events
        const id =
          typeof event === "string" && event.startsWith("__CHANNEL__:")
            ? Number(event.slice("__CHANNEL__:".length))
            : typeof event === "object" && event && "id" in event
              ? Number(event.id)
              : undefined
        if (id) win.__TAURI_INTERNALS__?.runCallback(id, { id: 0, message: { phase: "done" }, end: true })
        return { url: server(), password: null }
      }

      if (command === "get_default_server_url") return null
      if (command === "set_default_server_url") return null
      if (command === "get_wsl_config") return { enabled: false }
      if (command === "set_wsl_config") return null
      if (command === "get_display_backend") return null
      if (command === "set_display_backend") return null
      if (command === "kill_sidecar") return null
      if (command === "install_cli") return ""
      if (command === "check_app_exists") return false
      if (command === "resolve_app_path") return null
      if (command === "wsl_path") return args.path
      if (command === "parse_markdown_command") return String(args.markdown ?? "")
      if (command === "read_text_file") return ""
      if (command === "convert_sheet_to_csv") return ""
      if (command === "parse_dxf") return {
        sourcePath: "",
        layers: [],
        entities: [],
        bounds: { minX: 0, minY: 0, maxX: 0, maxY: 0 },
        totalEntityCount: 0,
      }
      if (command === "convert_dwg_to_dxf") return ""
      if (command === "convert_pptx_to_images") return []
      if (command === "convert_docx_to_html") return ""

      if (command === "plugin:store|load") return load(storeKey(args))
      if (command === "plugin:store|get_store") return paths.get(storeKey(args)) ?? null
      if (command === "plugin:store|get") {
        const store = read(args)
        const key = typeof args.key === "string" ? args.key : ""
        if (!store || !store.has(key)) return [null, false]
        return [store.get(key), true]
      }
      if (command === "plugin:store|set") {
        const store = read(args)
        if (store && typeof args.key === "string") store.set(args.key, args.value)
        return null
      }
      if (command === "plugin:store|delete") {
        const store = read(args)
        if (!store || typeof args.key !== "string") return false
        return store.delete(args.key)
      }
      if (command === "plugin:store|has") {
        const store = read(args)
        return typeof args.key === "string" ? (store?.has(args.key) ?? false) : false
      }
      if (command === "plugin:store|clear" || command === "plugin:store|reset") {
        read(args)?.clear()
        return null
      }
      if (command === "plugin:store|keys") return Array.from(read(args)?.keys() ?? [])
      if (command === "plugin:store|values") return Array.from(read(args)?.values() ?? [])
      if (command === "plugin:store|entries") return Array.from(read(args)?.entries() ?? [])
      if (command === "plugin:store|length") return read(args)?.size ?? 0
      if (command === "plugin:store|reload" || command === "plugin:store|save") return null

      if (command === "plugin:menu|new") {
        const kind = typeof args.kind === "string" ? args.kind : "MenuItem"
        return [resource++, `${kind.toLowerCase()}-browser-${resource}`]
      }
      if (command === "plugin:menu|create_default") return [resource++, `menu-browser-${resource}`]
      if (command === "plugin:menu|items") return []
      if (command === "plugin:menu|get") return null
      if (command === "plugin:menu|text") return ""
      if (command === "plugin:menu|is_enabled") return true
      if (command === "plugin:menu|remove_at") return null
      if (command === "plugin:menu|set_as_app_menu") return null
      if (command === "plugin:menu|set_as_window_menu") return null
      if (command.startsWith("plugin:")) return null

      return null
    },
    runCallback: (id, data) => void callbacks.get(id)?.(data),
    transformCallback: (callback, once = false) => {
      const id = next++
      callbacks.set(id, (data) => {
        if (once) callbacks.delete(id)
        return callback?.(data)
      })
      return id
    },
    unregisterCallback: (id) => {
      callbacks.delete(id)
    },
  }
}
