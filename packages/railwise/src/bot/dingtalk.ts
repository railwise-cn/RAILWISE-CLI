import crypto from "node:crypto"
import type {
  BotAdapter,
  BotMessageHandler,
  ExcelReport,
  IncomingMessage,
  OutgoingMessage,
} from "./types.js"

export interface DingtalkAdapterOptions {
  appKey?: string
  appSecret?: string
  clientId?: string
  clientSecret?: string
  webhookSecret?: string
}

export class DingtalkAdapter implements BotAdapter {
  readonly platform = "dingtalk" as const
  private handler?: BotMessageHandler
  private client?: unknown

  constructor(private readonly opts: DingtalkAdapterOptions = {}) {}

  /**
   * Verify DingTalk webhook signature
   */
  verifySignature(timestamp: string, sign: string): boolean {
    if (!this.opts.webhookSecret) return true // skip if secret not configured
    
    try {
      const stringToSign = `${timestamp}\n${this.opts.webhookSecret}`;
      const hmac = crypto.createHmac('sha256', this.opts.webhookSecret);
      hmac.update(stringToSign);
      const computedSign = hmac.digest('base64');
      return computedSign === sign;
    } catch (e) {
      return false;
    }
  }

  async start() {
    this.client = this.init()
  }

  async stop() {
  }

  setHandler(fn: BotMessageHandler) {
    this.handler = fn
  }

  async sendMessage(msg: OutgoingMessage) {
    void msg
    void this.client
  }

  async sendExcelReport(report: ExcelReport) {
    await this.sendMessage({
      userId: report.userId,
      groupId: report.groupId,
      text: report.summary,
      file: {
        name: report.name,
        mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        data: report.data,
        url: report.url,
      },
    })
  }

  async handle(raw: unknown, headers?: Record<string, string>) {
    // Check signature if headers are provided
    if (headers && headers['timestamp'] && headers['sign']) {
      if (!this.verifySignature(headers['timestamp'], headers['sign'])) {
        console.error("DingTalk Webhook Signature Validation Failed");
        return;
      }
    }

    const msg = this.parse(raw)
    if (!msg || !this.handler) return
    await this.handler(msg)
  }

  private init() {
    return {
      appKey: this.opts.appKey,
      appSecret: this.opts.appSecret,
      clientId: this.opts.clientId,
      clientSecret: this.opts.clientSecret,
      webhookSecret: this.opts.webhookSecret,
    }
  }

  private parse(raw: unknown): IncomingMessage | undefined {
    void raw
    return undefined
  }
}
