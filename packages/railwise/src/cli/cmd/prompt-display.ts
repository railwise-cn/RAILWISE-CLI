const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" })

function width(value: string) {
  if (value === "\n") return 1
  return Bun.stringWidth(value)
}

export function promptOffsetWidth(value: string) {
  let result = 0
  for (const part of graphemes.segment(value)) {
    result += width(part.segment)
  }
  return result
}

export function displaySlice(value: string, start: number, end = Infinity) {
  let offset = 0
  let result = ""
  for (const part of graphemes.segment(value)) {
    const next = offset + width(part.segment)
    if (next <= start) {
      offset = next
      continue
    }
    if (offset >= end) break
    result += part.segment
    offset = next
  }
  return result
}
