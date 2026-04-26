import type { DxfDocument, OfficeImage } from "../../bindings"

export type FileKind = "csv" | "xlsx" | "dxf" | "dwg" | "pptx" | "docx" | "pdf" | "markdown" | "unknown"

export type WorkspaceFile = {
  id: string
  path: string
  name: string
  kind: FileKind
}

export type TableData = {
  columns: string[]
  rows: string[][]
}

export type Preview = {
  loading: boolean
  error?: string
  table?: TableData
  dxf?: DxfDocument
  html?: string
  text?: string
  pdf?: string
  images?: OfficeImage[]
}
