import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import path from "path"
import z from "zod"
import { builtins as items } from "./builtin"
import type { CapabilityManifest } from "./schema"

const State = z
  .object({
    enabled: z.record(z.string(), z.boolean()).default({}),
  })
  .catch({ enabled: {} })
const file = path.join(Global.Path.state, "marketplace.json")
const enabled = new Map<string, boolean>()
const tools: Record<string, string> = {
  bash: "railwise.mcp.local_tools",
  edit: "railwise.mcp.local_tools",
  write: "railwise.mcp.local_tools",
  apply_patch: "railwise.mcp.local_tools",
  read: "railwise.tool.file_reader",
  glob: "railwise.tool.file_reader",
  grep: "railwise.tool.file_reader",
  skill: "railwise.skill.survey_review",
}

async function load() {
  return State.parse(await Bun.file(file).json().catch(() => ({})))
}

for (const [id, state] of Object.entries((await load()).enabled)) enabled.set(id, state)

export namespace Marketplace {
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

  export function isEnabled(id: string) {
    return get(id)?.enabled ?? false
  }

  export function toolEnabled(id: string) {
    const capability = tools[id]
    if (!capability) return true
    return isEnabled(capability)
  }

  export function mcpEnabled() {
    return isEnabled("railwise.mcp.local_tools")
  }

  async function save() {
    await Filesystem.writeJson(file, { enabled: Object.fromEntries(enabled) })
  }

  export async function reload() {
    enabled.clear()
    for (const [id, state] of Object.entries((await load()).enabled)) enabled.set(id, state)
  }

  export async function setEnabled(id: string, state: boolean) {
    const item = items.find((item) => item.id === id)
    if (!item) return undefined
    enabled.set(id, state)
    await save()
    return resolve(item)
  }

  export async function reset() {
    enabled.clear()
    await save()
  }

  export function groups(list: CapabilityManifest[]) {
    return Array.from(new Set(list.map((item) => item.kind))).map((kind) => ({
      kind,
      items: list.filter((item) => item.kind === kind),
    }))
  }
}
