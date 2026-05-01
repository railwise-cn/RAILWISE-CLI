export type PointStatus = "green" | "yellow" | "red" | "gray"

export function calcPointStatus(
  latestValue: number,
  threshold: { warning: number; alert: number },
  updatedAt: number,
  recentTrend?: number[],
): PointStatus {
  if (Date.now() - updatedAt > 24 * 3_600_000) return "gray"
  if (latestValue >= threshold.alert * 0.8) return "red"
  if (recentTrend && recentTrend.length >= 3 && recentTrend.slice(-3).every((value) => value > threshold.warning * 0.2))
    return "red"
  if (latestValue >= threshold.alert * 0.5) return "yellow"
  return "green"
}
