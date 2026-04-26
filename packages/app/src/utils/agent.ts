const defaults: Record<string, string> = {
  ask: "var(--icon-agent-ask-base)",
  build: "var(--icon-agent-build-base)",
  docs: "var(--icon-agent-docs-base)",
  plan: "var(--icon-agent-plan-base)",
  primary: "var(--text-interactive-base, #1890ff)",
  secondary: "var(--text-base, rgb(47, 38, 24))",
  accent: "var(--rw-accent, rgba(117, 86, 32, 0.9))",
  success: "var(--rw-success, #52c41a)",
  warning: "var(--rw-warning, #faad14)",
  error: "var(--rw-error, #ff4d4f)",
  info: "var(--rw-info, #1890ff)",
}

export function agentColor(name: string, custom?: string) {
  const value = custom?.trim()
  if (value) return defaults[value] ?? value
  return defaults[name] ?? defaults[name.toLowerCase()] ?? "var(--rw-accent, rgba(117, 86, 32, 0.9))"
}
