export type BotPlatform = "feishu" | "dingtalk" | "console"

export interface ImageInfo {
  id?: string
  name?: string
  mime?: string
  size?: number
  width?: number
  height?: number
  url?: string
  key?: string
}

export interface IncomingMessage {
  platform: BotPlatform
  messageId?: string
  userId: string
  groupId?: string
  text?: string
  images: ImageInfo[]
  file?: { name: string, mime?: string, data?: Uint8Array }
  raw?: unknown
  timestamp?: number
}

export interface OutgoingMessage {
  userId?: string
  groupId?: string
  text?: string
  card?: unknown
  file?: {
    name: string
    mime?: string
    data?: Uint8Array
    url?: string
    key?: string
  }
}

export interface ExcelReport {
  userId?: string
  groupId?: string
  name: string
  data?: Uint8Array
  url?: string
  summary?: string
}

export type BotMessageHandler = (msg: IncomingMessage) => Promise<void> | void

export interface BotAdapter {
  readonly platform: BotPlatform
  start(): Promise<void>
  stop(): Promise<void>
  setHandler(fn: BotMessageHandler): void
  sendMessage(msg: OutgoingMessage): Promise<void>
  sendExcelReport(report: ExcelReport): Promise<void>
}
