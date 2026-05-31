import { builtins as items } from "./builtin"
import type { CapabilityManifest } from "./schema"

export namespace Marketplace {
  export function list() {
    return items
  }

  export function builtins() {
    return list()
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }
}
