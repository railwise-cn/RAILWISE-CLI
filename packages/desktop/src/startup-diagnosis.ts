export type StartupIssue = "config" | "port" | "server" | "permission" | "unknown"

export type StartupDiagnosis = {
  issue: StartupIssue
  title: string
  summary: string
  steps: string[]
  path?: string
  target?: string
  action?: string
}

function text(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error ?? "")
}

function match(value: string, words: string[]) {
  const lower = value.toLowerCase()
  return words.some((word) => lower.includes(word))
}

export function startupConfigPath(error: unknown) {
  return text(error).match(/(?:[A-Z]:\\|\/)[^\s"']*railwise\.jsonc?/i)?.[0]
}

export function startupDiagnosis(error: unknown): StartupDiagnosis {
  const value = text(error)
  const path = startupConfigPath(value)
  if (
    match(value, [
      "configinvaliderror",
      "configjsonerror",
      "configuration is invalid",
      "railwise.json",
      "invalid input",
    ])
  ) {
    return {
      issue: "config",
      title: "配置文件需要修复",
      summary: "RAILWISE 读取配置时遇到不兼容或格式错误。",
      path,
      target: path,
      action: path ? "打开配置文件" : "打开配置目录",
      steps: [
        "检查 railwise.json / railwise.jsonc 中的模型、智能体和 tools 配置。",
        "如果看到 tools 下是数组或旧格式，请更新到最新版后重启；当前版本会兼容分类数组。",
        "仍无法启动时，先临时移走该配置文件，再重新启动应用定位问题。",
      ],
    }
  }
  if (match(value, ["address already in use", "eaddrinuse"])) {
    return {
      issue: "port",
      title: "本地端口被占用",
      summary: "RAILWISE 核心服务需要的本地端口正在被其他进程使用。",
      steps: ["退出已有 RAILWISE/railwise serve 进程。", "重启应用，让桌面端重新分配本地服务连接。"],
    }
  }
  if (match(value, ["operation not permitted", "permission denied", "eacces", "eperm", "access denied"])) {
    return {
      issue: "permission",
      title: "系统权限阻止启动",
      summary: "桌面端无法访问启动核心服务所需的文件或目录。",
      steps: [
        "确认应用位于可执行目录，不在被系统隔离的位置。",
        "检查配置目录和项目目录是否有读写权限。",
        "重新启动应用后再试。",
      ],
    }
  }
  if (match(value, ["health check", "timed out", "failed to spawn", "failed to start server", "connection"])) {
    return {
      issue: "server",
      title: "核心服务未能启动",
      summary: "桌面外壳已打开，但本地 RAILWISE 服务没有在预期时间内就绪。",
      action: "打开日志目录",
      steps: [
        "先重新启动应用。",
        "如果连续失败，检查是否有旧进程占用本地服务。",
        "打开日志目录并保留最新日志，继续定位 sidecar 启动原因。",
      ],
    }
  }
  return {
    issue: "unknown",
    title: "启动失败",
    summary: "桌面端启动时遇到未分类错误。",
    steps: ["重新启动应用。", "如果仍然失败，复制下方错误信息继续排查。"],
  }
}
