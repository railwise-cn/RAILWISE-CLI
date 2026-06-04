type AgentLike = {
  name: string
  displayName?: string
}

const builtins: Record<string, string> = {
  chief_manager: "RAILWISE",
  qa_inspector: "数据质检",
  cpiii_specialist: "CPIII 专家",
  adjustment_computer: "平差计算",
  norm_librarian: "规范检索",
  knowledge_curator: "知识整理",
  source_ingestor: "资料导入",
  writer: "报告编制",
  ppt_master: "汇报生成",
}

export function agentDisplayName(input?: AgentLike | string | null) {
  const name = typeof input === "string" ? input : input?.name
  const label = typeof input === "string" ? undefined : input?.displayName?.trim()
  if (name === "chief_manager") return builtins.chief_manager
  if (label) return label
  if (!name) return ""
  return builtins[name] ?? name.replaceAll("_", " ")
}

export function agentInitial(input?: AgentLike | string | null) {
  return agentDisplayName(input).trim()[0]?.toUpperCase() ?? "R"
}
