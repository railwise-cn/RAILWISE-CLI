import type { WorkflowDeliveryArchive } from "@/types/agent-studio"

type DeliveryFile = NonNullable<WorkflowDeliveryArchive["files"]>[number]

export type WorkflowCompletionStatus = {
  workflowId: string
  sessionId: string
  durationMs: number
}

export type DeliveryPathRow = {
  label: string
  path: string
  absolute: string | undefined
  folder: boolean
}

export type DeliveryFileRow = {
  kind: DeliveryFile["kind"]
  label: string
  path: string
  absolute: string
  source: string | undefined
  copied: boolean
  status: string
}

export function deliveryRows(item: WorkflowDeliveryArchive) {
  const rows: (DeliveryPathRow | undefined)[] = [
    item.directoryPath
      ? { label: "目录", path: item.directoryPath, absolute: item.absoluteDirectoryPath, folder: true }
      : undefined,
    { label: "摘要", path: item.markdownPath, absolute: item.absoluteMarkdownPath, folder: false },
    item.manifestPath
      ? { label: "清单", path: item.manifestPath, absolute: item.absoluteManifestPath, folder: false }
      : undefined,
  ]
  return rows.filter((row): row is DeliveryPathRow => Boolean(row?.path))
}

export function deliveryFiles(item: WorkflowDeliveryArchive) {
  return (
    item.files?.map(
      (file): DeliveryFileRow => ({
        kind: file.kind,
        label: file.label || fileLabel(file.kind),
        path: file.path,
        absolute: file.absolutePath,
        source: file.sourcePath,
        copied: file.copied,
        status: file.copied ? "已写入" : "未写入",
      }),
    ) ?? []
  )
}

export function deliveryFileCount(item: WorkflowDeliveryArchive) {
  return item.fileCount ?? (deliveryFiles(item).filter((file) => file.copied).length || 1)
}

export function deliveryMissingCount(item: WorkflowDeliveryArchive) {
  return deliveryFiles(item).filter((file) => !file.copied).length
}

export function deliveryStatus(item: WorkflowDeliveryArchive) {
  const missing = deliveryMissingCount(item)
  if (missing) return `缺失 ${missing} 个文件`
  return `完整 · ${deliveryFileCount(item)} 个文件`
}

export function completionDuration(item: WorkflowCompletionStatus | undefined) {
  if (!item) return undefined
  const seconds = Math.max(0, item.durationMs) / 1000
  if (seconds < 60) {
    const rounded = Math.round(seconds * 10) / 10
    return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)} 秒`
  }
  const minutes = Math.floor(seconds / 60)
  const rest = Math.floor(seconds % 60)
  return `${minutes} 分 ${rest.toString().padStart(2, "0")} 秒`
}

export function workflowCompletionSummary(input: {
  completion?: WorkflowCompletionStatus
  delivery?: WorkflowDeliveryArchive
  acceptanceOk?: boolean
}) {
  if (!input.completion && !input.acceptanceOk) return undefined
  const base = input.completion
    ? ["已完成", completionDuration(input.completion)].filter(Boolean).join(" · ")
    : "已通过"
  if (!input.delivery) return `${base} · 待导出交付包`
  const missing = deliveryMissingCount(input.delivery)
  if (missing) return `${base} · 交付包缺失 ${missing} 个文件`
  return `${base} · 交付包完整 ${deliveryFileCount(input.delivery)} 个文件`
}

function fileLabel(kind: DeliveryFile["kind"]) {
  if (kind === "summary") return "交付摘要"
  if (kind === "manifest") return "Manifest"
  return "附件"
}
