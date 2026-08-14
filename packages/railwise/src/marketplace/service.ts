import { builtins as builtin } from "./builtin"
import { CapabilityGroup, CapabilityManifest, type CapabilityKind, type CapabilityPermission } from "./schema"
import { Storage } from "../storage/storage"
import { toolInventory } from "../tool/inventory"

export namespace Marketplace {
  type Override = {
    enabled?: boolean
    installed?: boolean
    updated_at?: number
  }

  type ToolItem = Awaited<ReturnType<typeof toolInventory>>[number]

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

  function toolPermission(id: string): CapabilityPermission {
    if (id === "bash") {
      return {
        filesystem: "read",
        network: false,
        shell: true,
        external_directory: false,
        secrets: false,
      }
    }
    if (["edit", "write", "apply_patch", "report_export", "docx_report_formatter", "pptx_brief_builder"].includes(id)) {
      return {
        filesystem: "write",
        network: false,
        shell: false,
        external_directory: false,
        secrets: false,
      }
    }
    if (["webfetch", "websearch", "codesearch"].includes(id)) {
      return {
        filesystem: "none",
        network: true,
        shell: false,
        external_directory: false,
        secrets: false,
      }
    }
    return {
      filesystem: "read",
      network: false,
      shell: false,
      external_directory: false,
      secrets: false,
    }
  }

  function toolDescription(item: ToolItem) {
    if (item.group === "agent") return "调度智能体或加载专业 Skill，支撑多智能体协作。"
    if (item.group === "knowledge") return "检索、维护或引用工程规范和知识库内容。"
    if (item.group === "survey") return "处理测绘、监测、平差、复测和成果交付相关生产任务。"
    if (item.group === "core") return "在当前工作区内执行文件、搜索、命令或上下文操作。"
    return "由本地配置、插件或 MCP 扩展提供的工具能力。"
  }

  function toolTag(item: ToolItem) {
    if (item.group === "agent") return "智能体"
    if (item.group === "knowledge") return "知识"
    if (item.group === "survey") return "测绘生产"
    if (item.group === "core") return "基础执行"
    return "扩展"
  }

  async function registry() {
    const tools = await toolInventory().catch((): ToolItem[] => [])
    const generated = tools.map((item): CapabilityManifest => ({
      id: `railwise.tool.${item.id}`,
      kind: "tool",
      name: item.label,
      description: toolDescription(item),
      version: "0.1.0",
      source: "builtin",
      enabled: true,
      installed: true,
      permissions: toolPermission(item.id),
      tags: [toolTag(item)],
    }))
    return Array.from(new Map([...generated, ...builtin].map((item) => [item.id, CapabilityManifest.parse(item)])).values())
  }

  export async function list() {
    const current = await state()
    return (await registry()).map((item) => apply(item, current[item.id]))
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
    const item = (await registry()).find((item) => item.id === id)
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
    const item = (await registry()).find((item) => item.id === id)
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
