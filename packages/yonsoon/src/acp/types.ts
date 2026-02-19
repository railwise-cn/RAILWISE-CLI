import type { McpServer } from "@agentclientprotocol/sdk"
import type { YonsoonClient } from "@yonsoon/sdk/v2"

export interface ACPSessionState {
  id: string
  cwd: string
  mcpServers: McpServer[]
  createdAt: Date
  model?: {
    providerID: string
    modelID: string
  }
  variant?: string
  modeId?: string
}

export interface ACPConfig {
  sdk: YonsoonClient
  defaultModel?: {
    providerID: string
    modelID: string
  }
}
