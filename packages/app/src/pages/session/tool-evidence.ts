import type { ToolPart } from "@railwise/sdk/v2/client"

export type ToolEvidence = {
  input: string
  output: string
  risk: {
    label: string
    tone: "success" | "warning" | "danger" | "neutral"
  }
  artifacts: Array<{
    label: string
    path: string
  }>
}

function compact(value: string, length = 120) {
  const text = value.replace(/\s+/g, " ").trim()
  if (text.length <= length) return text
  return `${text.slice(0, length - 3)}...`
}

function stringify(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value) ?? ""
  } catch {
    return String(value)
  }
}

function basename(value: string) {
  return value.split(/[\\/]/).filter(Boolean).at(-1) ?? value
}

function paths(value: unknown): string[] {
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap(paths)
  return []
}

function metadata(part: ToolPart) {
  if (part.state.status === "pending") return {}
  return part.state.metadata ?? {}
}

function isReviewNeeded(value: unknown) {
  if (typeof value === "boolean") return !value
  if (typeof value === "number") return value > 0
  if (Array.isArray(value)) return value.length > 0
  return false
}

function risk(part: ToolPart): ToolEvidence["risk"] {
  if (part.state.status === "error") return { label: "失败", tone: "danger" }
  if (part.state.status === "pending" || part.state.status === "running") return { label: "处理中", tone: "neutral" }

  const data = metadata(part)
  if (isReviewNeeded(data.pass)) return { label: "需复核", tone: "warning" }
  if (isReviewNeeded(data.missing) || isReviewNeeded(data.alerts)) return { label: "需复核", tone: "warning" }
  return { label: "通过", tone: "success" }
}

function artifacts(part: ToolPart) {
  if (part.state.status !== "completed") return []

  const data = metadata(part)
  const list = [
    ...(part.state.attachments ?? []).flatMap((item) =>
      item.source?.type === "file" ? [item.source.path] : item.filename ? [item.filename] : [],
    ),
    ...paths(data.outputPath),
    ...paths(data.file),
    ...paths(data.files),
    ...paths(data.documents),
  ]
  const seen = new Set<string>()

  return list
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      if (seen.has(item)) return false
      seen.add(item)
      return true
    })
    .slice(0, 4)
    .map((path) => ({
      label: basename(path),
      path,
    }))
}

export function toolEvidence(part: ToolPart): ToolEvidence {
  const state = part.state
  const output =
    state.status === "completed"
      ? state.output
      : state.status === "error"
        ? state.error
        : state.status === "pending"
          ? state.raw || stringify(state.input)
          : "工具正在执行，等待结果返回。"

  return {
    input: compact(stringify(state.input)),
    output: compact(output),
    risk: risk(part),
    artifacts: artifacts(part),
  }
}
