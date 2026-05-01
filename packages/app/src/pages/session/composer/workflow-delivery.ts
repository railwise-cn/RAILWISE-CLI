import type { WorkflowDeliveryArchive } from "@/types/agent-studio"

type DeliveryFile = NonNullable<WorkflowDeliveryArchive["files"]>[number]

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
    item.files?.map((file): DeliveryFileRow => ({
      kind: file.kind,
      label: file.label || fileLabel(file.kind),
      path: file.path,
      absolute: file.absolutePath,
      source: file.sourcePath,
      copied: file.copied,
      status: file.copied ? "已写入" : "未写入",
    })) ?? []
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

function fileLabel(kind: DeliveryFile["kind"]) {
  if (kind === "summary") return "交付摘要"
  if (kind === "manifest") return "Manifest"
  return "附件"
}
