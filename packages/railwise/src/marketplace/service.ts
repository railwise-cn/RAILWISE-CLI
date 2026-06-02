import { builtins as builtin } from "./builtin"
import { CapabilityGroup, CapabilityManifest, type CapabilityKind } from "./schema"

export namespace Marketplace {
  export function list() {
    return builtin.map((item) => CapabilityManifest.parse(item))
  }

  export function builtins() {
    return list().filter((item) => item.source === "builtin")
  }

  export function groups(list: CapabilityManifest[]) {
    const order: CapabilityKind[] = ["agent", "tool", "skill", "workflow", "mcp", "provider", "harness_profile"]
    return order
      .map((kind) => ({
        kind,
        items: list.filter((item) => item.kind === kind),
      }))
      .filter((group) => group.items.length > 0)
      .map((group) => CapabilityGroup.parse(group))
  }

  export function get(id: string) {
    return list().find((item) => item.id === id)
  }
}
