import type { TableData } from "./types"

export function parseCsv(input: string): TableData {
  const parsed = rows(input)
  const [head, ...body] = parsed.filter((row) => row.some((cell) => cell.trim().length > 0))
  const width = Math.max(...parsed.map((row) => row.length), 1)
  const columns = (head?.length ? head : Array.from({ length: width }, (_, index) => `列 ${index + 1}`)).map(
    (cell, index) => cell.trim() || `列 ${index + 1}`,
  )

  return {
    columns,
    rows: body.map((row) => columns.map((_, index) => row[index] ?? "")),
  }
}

function rows(input: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ""
  let quoted = false

  for (let index = 0; index < input.length; index++) {
    const char = input[index]
    const next = input[index + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      index += 1
      continue
    }

    if (char === '"') {
      quoted = !quoted
      continue
    }

    if (char === "," && !quoted) {
      row.push(cell)
      cell = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ""
      continue
    }

    cell += char
  }

  row.push(cell)
  rows.push(row)
  return rows
}
