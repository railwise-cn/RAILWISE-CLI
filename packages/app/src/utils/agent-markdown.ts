export const PermissionActions = ["allow", "ask", "deny"] as const
export type PermissionAction = (typeof PermissionActions)[number]

const Frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function split(raw: string) {
  const match = raw.match(Frontmatter)
  if (!match) return { header: "", body: raw, has: false }
  return {
    header: match[1],
    body: raw.slice(match[0].length),
    has: true,
  }
}

function join(header: string, body: string) {
  return `---\n${header.trimEnd()}\n---\n\n${body.trimStart()}`
}

function quote(value: string) {
  if (!value.includes(":") && !value.includes("#") && !value.includes("\n")) return value
  return JSON.stringify(value)
}

function unquote(value: string) {
  const trimmed = value.trim()
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) return trimmed.slice(1, -1)
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1)
  return trimmed
}

function childBlock(lines: string[], key: string) {
  const start = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*$`)))
  if (start < 0) return
  const end = lines.findIndex((line, index) => index > start && line.match(/^[A-Za-z_][A-Za-z0-9_]*:/))
  return {
    start,
    end: end < 0 ? lines.length : end,
  }
}

export function stripFrontmatter(raw: string) {
  return split(raw).body.trim()
}

export function shortDescription(input?: string, max = 82) {
  const text = (input ?? "").replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1).trimEnd()}…`
}

export function readScalar(raw: string, key: string) {
  const line = split(raw)
    .header.split(/\r?\n/)
    .find((item) => item.match(new RegExp(`^${key}:\\s*`)))
  if (!line) return
  return unquote(line.replace(new RegExp(`^${key}:\\s*`), ""))
}

export function readPermission(raw: string, key: string): PermissionAction {
  const lines = split(raw).header.split(/\r?\n/)
  const block = childBlock(lines, "permission")
  const found = block
    ? lines
        .slice(block.start + 1, block.end)
        .map((line) => line.match(new RegExp(`^\\s+${key}:\\s*(allow|ask|deny)\\s*$`))?.[1])
        .find((value): value is PermissionAction => !!value)
    : undefined
  return found ?? "deny"
}

export function setScalar(raw: string, key: string, value: string) {
  const parsed = split(raw)
  const lines = parsed.header ? parsed.header.split(/\r?\n/) : []
  const index = lines.findIndex((line) => line.match(new RegExp(`^${key}:\\s*`)))
  const next = `${key}: ${quote(value)}`
  if (index >= 0) lines[index] = next
  else lines.push(next)
  return join(lines.join("\n"), parsed.body)
}

export function removeScalar(raw: string, key: string) {
  const parsed = split(raw)
  return join(
    (parsed.header ? parsed.header.split(/\r?\n/) : [])
      .filter((line) => !line.match(new RegExp(`^${key}:\\s*`)))
      .join("\n"),
    parsed.body,
  )
}

export function setPermission(raw: string, key: string, value: PermissionAction) {
  const parsed = split(raw)
  const lines = parsed.header ? parsed.header.split(/\r?\n/) : []
  const block = childBlock(lines, "permission")
  if (!block) return join([...lines, "permission:", `  ${key}: ${value}`].join("\n"), parsed.body)

  const index =
    lines.slice(block.start + 1, block.end).findIndex((line) => line.match(new RegExp(`^\\s+${key}:\\s*`))) +
    block.start +
    1
  if (index > block.start) lines[index] = `  ${key}: ${value}`
  else lines.splice(block.start + 1, 0, `  ${key}: ${value}`)
  return join(lines.join("\n"), parsed.body)
}
