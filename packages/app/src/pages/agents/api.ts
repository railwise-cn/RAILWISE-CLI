import type { Workflow } from "@/types/workflow"
import type {
  AgentStudioDetail,
  AgentStudioItem,
  FormatCoverageReport,
  WikiReportDetail,
  WikiStatus,
  WorkflowCheck,
  WorkflowRun,
} from "@/types/agent-studio"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"

function auth(server: NonNullable<ReturnType<typeof useServer>["current"]>) {
  if (!server.http.password) return {}
  return {
    Authorization: `Basic ${btoa(`${server.http.username ?? "railwise"}:${server.http.password}`)}`,
  }
}

export function useAgentStudioApi() {
  const platform = usePlatform()
  const server = useServer()

  async function request<T>(path: string, init?: RequestInit) {
    if (!server.current) throw new Error("Server not available")
    const headers = new Headers(init?.headers)
    Object.entries(auth(server.current)).forEach(([key, value]) => headers.set(key, value))
    const response = await (platform.fetch ?? globalThis.fetch)(`${server.current.http.url}/agent-studio${path}`, {
      ...init,
      headers,
    })
    if (!response.ok) throw new Error(await response.text())
    return (await response.json()) as T
  }

  return {
    list: () => request<AgentStudioItem[]>("/list"),
    detail: (name: string) => request<AgentStudioDetail>(`/${encodeURIComponent(name)}`),
    update: (name: string, rawMarkdown: string) =>
      request<boolean>(`/${encodeURIComponent(name)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawMarkdown }),
      }),
    presets: () => request<Workflow[]>("/workflow/presets"),
    workflowCheck: (workflowId: string) => request<WorkflowCheck>(`/workflow/check/${encodeURIComponent(workflowId)}`),
    formatReport: () => request<FormatCoverageReport>("/format/report"),
    wikiStatus: () => request<WikiStatus>("/wiki/status"),
    wikiReport: (path: string) => request<WikiReportDetail>(`/wiki/report?path=${encodeURIComponent(path)}`),
    run: (workflowId: string) =>
      request<WorkflowRun>("/workflow/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workflowId }),
      }),
  }
}
