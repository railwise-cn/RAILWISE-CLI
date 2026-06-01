import { builtins as items } from "./builtin"
import type { CapabilityManifest } from "./schema"

export namespace Marketplace {
  const enabled = new Map<string, boolean>()

  function resolve(item: CapabilityManifest) {
    const state = enabled.get(item.id)
    if (state === undefined) return item
    return { ...item, enabled: state }
  }

  export function list() {
    return items.map(resolve)
  }

  export function builtins() {
    return items
  }

  export function get(id: string) {
    return list().find((item) => item.id === id)
  }

  export function setEnabled(id: string, state: boolean) {
    const item = items.find((item) => item.id === id)
    if (!item) return undefined
    enabled.set(id, state)
    return resolve(item)
  }

  export function reset() {
    enabled.clear()
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }
}
