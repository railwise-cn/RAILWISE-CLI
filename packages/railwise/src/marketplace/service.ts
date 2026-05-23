import { builtins } from "./builtin"
import type { CapabilityKind, CapabilityManifest } from "./schema"
import path from "path"
import z from "zod"
import { Filesystem } from "../util/filesystem"
import { Global } from "../global"

export namespace Marketplace {
  const State = z.object({
    enabled: z.record(z.string(), z.boolean()).default({}),
    installed: z.record(z.string(), z.boolean()).default({}),
  })
  type State = z.infer<typeof State>
  let file: string | undefined
  let state: State | undefined

  function target() {
    return file ?? process.env.RAILWISE_MARKETPLACE_STATE ?? path.join(Global.Path.config, "marketplace.json")
  }

  async function load(): Promise<State> {
    if (state) return state
    const data = await Filesystem.readJson(target()).catch(() => ({}))
    const parsed = State.safeParse(data)
    state = parsed.success ? parsed.data : { enabled: {}, installed: {} }
    return state
  }

  async function save(next: State) {
    state = next
    await Filesystem.writeJson(target(), next)
  }

  export function configure(path?: string) {
    file = path
    state = undefined
  }

  export async function list() {
    const data = await load()
    return builtins.map((item) => {
      const installed = data.installed[item.id] ?? item.installed
      return {
        ...item,
        installed,
        enabled: installed ? (data.enabled[item.id] ?? item.enabled) : false,
      }
    })
  }

  export async function get(id: string) {
    return (await list()).find((item) => item.id === id)
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind: CapabilityKind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }

  export async function set(id: string, enabled: boolean) {
    const item = await get(id)
    if (!item || !item.installed) return
    const data = await load()
    const peers =
      enabled && item.kind === "harness_profile"
        ? Object.fromEntries(builtins.filter((peer) => peer.kind === "harness_profile").map((peer) => [peer.id, false]))
        : {}
    await save({
      ...data,
      enabled: {
        ...data.enabled,
        ...peers,
        [id]: enabled,
      },
    })
    return {
      ...item,
      enabled,
    }
  }

  export async function install(id: string) {
    const item = await get(id)
    if (!item) return
    const data = await load()
    await save({
      ...data,
      installed: {
        ...data.installed,
        [id]: true,
      },
    })
    return {
      ...item,
      installed: true,
      enabled: data.enabled[id] ?? false,
    }
  }

  export async function uninstall(id: string) {
    const item = await get(id)
    if (!item) return
    const data = await load()
    await save({
      enabled: {
        ...data.enabled,
        [id]: false,
      },
      installed: {
        ...data.installed,
        [id]: false,
      },
    })
    return {
      ...item,
      installed: false,
      enabled: false,
    }
  }
}
