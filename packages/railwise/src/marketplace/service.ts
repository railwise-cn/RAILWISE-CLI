import { builtins } from "./builtin"
import type { CapabilityKind, CapabilityManifest } from "./schema"

export namespace Marketplace {
  const states = new Map<string, boolean>()

  export function list() {
    return builtins.map((item) => ({
      ...item,
      enabled: states.get(item.id) ?? item.enabled,
    }))
  }

  export function get(id: string) {
    return list().find((item) => item.id === id)
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind: CapabilityKind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }

  export function set(id: string, enabled: boolean) {
    const item = get(id)
    if (!item) return
    states.set(id, enabled)
    return {
      ...item,
      enabled,
    }
  }
}
