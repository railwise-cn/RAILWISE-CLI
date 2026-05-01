/**
 * Terminal title utilities
 * Provides functions for determining default terminal title status
 */

export function isDefaultTitle(title: string, number: number): boolean {
  const match = title.match(/^Terminal (\d+)$/)
  const parsed = match ? Number(match[1]) : undefined
  return Number.isFinite(number) && number > 0 && Number.isFinite(parsed) && parsed === number
}
