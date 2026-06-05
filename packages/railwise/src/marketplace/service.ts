import { builtins as builtin } from "./builtin"
import { CapabilityGroup, CapabilityManifest, type CapabilityKind } from "./schema"
import { Storage } from "../storage/storage"

export namespace Marketplace {
  type Override = {
    enabled?: boolean
    installed?: boolean
    updated_at?: number
  }

  const key = ["marketplace", "capabilities"]

  async function state() {
    return Storage.read<Record<string, Override>>(key).catch((): Record<string, Override> => ({}))
  }

  async function save(next: Record<string, Override>) {
    await Storage.write(key, next)
  }

  function apply(item: CapabilityManifest, override?: Override) {
    return CapabilityManifest.parse({
      ...item,
      enabled: override?.enabled ?? item.enabled,
      installed: override?.installed ?? item.installed,
    })
  }

  export async function list() {
    const current = await state()
    return builtin.map((item) => apply(item, current[item.id]))
  }

  export function builtins() {
    return builtin.map((item) => CapabilityManifest.parse(item)).filter((item) => item.source === "builtin")
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

  export async function get(id: string) {
    return (await list()).find((item) => item.id === id)
  }

  export async function enable(id: string) {
    const item = builtin.find((item) => item.id === id)
    if (!item) return
    const current = await state()
    current[id] = {
      ...current[id],
      enabled: true,
      installed: true,
      updated_at: Date.now(),
    }
    await save(current)
    return apply(item, current[id])
  }

  export async function disable(id: string) {
    const item = builtin.find((item) => item.id === id)
    if (!item) return
    const current = await state()
    current[id] = {
      ...current[id],
      enabled: false,
      installed: true,
      updated_at: Date.now(),
    }
    await save(current)
    return apply(item, current[id])
  }
}
