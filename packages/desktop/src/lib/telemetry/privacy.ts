type Json = null | boolean | number | string | Json[] | { [key: string]: Json }

const sensitive = /(?:prompt|content|message|text|raw|input|output|file|filename|path|project|token|secret|key)/i
const allowed = /^(agent|event|kind|phase|route|source|status|template|type|version)$/
const pathLike =
  /(?:[A-Za-z]:\\|\/Users\/|\/home\/|\/var\/|\/tmp\/|\\\\|[\w.-]+\.(?:csv|xlsx|dxf|dwg|pptx|docx|pdf|md|json|ts|tsx|rs))/g

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function scalar(key: string, value: unknown): Json | undefined {
  if (value === null) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined
  if (typeof value !== "string") return undefined
  if (sensitive.test(key)) return "[redacted]"

  const next = value.replace(pathLike, "[redacted]")
  if (next !== value) return next
  if (allowed.test(key)) return next.slice(0, 96)
  if (/^[a-z0-9_.:-]{1,64}$/i.test(next)) return next
  return "[redacted]"
}

export function sanitize(value: Record<string, unknown>): Record<string, Json> {
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, item]) => {
        const next = sanitizeValue(key, item)
        return next === undefined ? undefined : ([key, next] as const)
      })
      .filter((item): item is readonly [string, Json] => item !== undefined),
  )
}

export function sanitizeValue(key: string, value: unknown): Json | undefined {
  const next = scalar(key, value)
  if (next !== undefined) return next
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(key, item)).filter((item) => item !== undefined)
  if (!record(value)) return undefined
  return sanitize(value)
}
