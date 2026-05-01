/**
 * Comment note utilities
 * Provides functions for formatting and creating metadata for comment notes
 */

export interface CommentMetadata {
  path: string
  selection?: { startLine: number; endLine: number }
  comment: string
  preview?: string
  origin?: string
}

export function createCommentMetadata(options: CommentMetadata) {
  return {
    type: "comment",
    path: options.path,
    selection: options.selection,
    comment: options.comment,
    preview: options.preview,
    origin: options.origin,
  }
}

export function formatCommentNote(options: {
  path: string
  selection?: { startLine: number; endLine: number }
  comment: string
}): string {
  const { path, selection, comment } = options

  let note = `# ${path}`

  if (selection) {
    note += ` (lines ${selection.startLine}-${selection.endLine})`
  }

  note += `\n\n${comment}`

  return note
}