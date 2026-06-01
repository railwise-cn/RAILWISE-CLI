import type { ToolPart } from "@railwise/sdk/v2/client"

export type RecoveryKind = "permission" | "model" | "workspace" | "network" | "tool" | "unknown"

export type Recovery = {
  kind: RecoveryKind
  label: string
  summary: string
  guidance: string
}

const recoveries: Record<RecoveryKind, Recovery> = {
  permission: {
    kind: "permission",
    label: "权限阻断",
    summary: "权限或安全边界阻断",
    guidance: "如果需要权限，先说明风险并重新请求最小权限；不要绕过工作区边界。",
  },
  model: {
    kind: "model",
    label: "模型配置",
    summary: "模型、Provider、额度或 API Key 异常",
    guidance: "检查 Provider、模型、额度或 API Key；必要时切换到当前可用模型。",
  },
  workspace: {
    kind: "workspace",
    label: "工作区文件",
    summary: "工作区路径、目录或文件缺失",
    guidance: "核对工作区和文件路径；如果资料缺失，先列出需要用户补充的文件。",
  },
  network: {
    kind: "network",
    label: "连接异常",
    summary: "网络、端口或本地服务连接异常",
    guidance: "重试前确认服务、端口和网络状态；必要时提供离线替代步骤。",
  },
  tool: {
    kind: "tool",
    label: "工具参数",
    summary: "工具参数、输入格式或调用方式异常",
    guidance: "修正参数格式，或把复杂任务拆成更小的工具调用再继续。",
  },
  unknown: {
    kind: "unknown",
    label: "待判断",
    summary: "需要结合上下文判断失败原因",
    guidance: "先复盘上下文和错误信息，再给出最小、可验证的下一步。",
  },
}

function match(text: string, words: string[]) {
  return words.some((word) => text.includes(word))
}

function truncate(value: string, length: number) {
  if (value.length <= length) return value
  return value.slice(0, length - 3) + "..."
}

export function toolTitle(part: ToolPart) {
  if (part.state.status === "running" && part.state.title) return part.state.title
  if (part.state.status === "completed") return part.state.title
  return part.tool
}

export function toolInputPreview(value: unknown, length = 120) {
  if (value === undefined || value === null) return ""
  return truncate(typeof value === "string" ? value : JSON.stringify(value), length)
}

export function toolRecovery(part: ToolPart): Recovery {
  if (part.state.status !== "error") return recoveries.unknown
  const text = `${part.tool} ${part.state.error} ${toolInputPreview(part.state.input, 400)}`.toLowerCase()
  if (match(text, ["operation not permitted", "permission", "access denied", "forbidden", "unauthorized", "eacces", "eperm", "权限", "拒绝", "未授权"])) {
    return recoveries.permission
  }
  if (match(text, ["api key", "provider", "model", "quota", "rate limit", "invalid credentials", "context", "token", "401", "402", "模型", "密钥", "额度", "限流"])) {
    return recoveries.model
  }
  if (match(text, ["no such file", "enoent", "not found", "outside workspace", "cwd", "path", "directory", "file", "目录", "路径", "文件不存在"])) {
    return recoveries.workspace
  }
  if (match(text, ["timeout", "timed out", "network", "connection", "fetch", "dns", "proxy", "port", "连接", "超时", "网络", "端口"])) {
    return recoveries.network
  }
  if (match(text, ["invalid", "schema", "argument", "expected", "parse", "json", "参数", "格式"])) {
    return recoveries.tool
  }
  return recoveries.unknown
}

export function repairInstruction(part: ToolPart) {
  const input = toolInputPreview(part.state.input)
  const error = part.state.status === "error" ? truncate(part.state.error, 400) : ""
  const recovery = toolRecovery(part)
  return [
    "请继续处理刚才失败的工具调用。",
    `失败类型：${recovery.label}`,
    `建议方向：${recovery.guidance}`,
    `工具：${part.tool}`,
    `标题：${toolTitle(part)}`,
    input ? `输入摘要：${input}` : "",
    error ? `错误信息：${error}` : "",
    "请先确认失败原因，再给出最小修复步骤，并继续执行可安全推进的下一步。",
  ]
    .filter(Boolean)
    .join("\n")
}
