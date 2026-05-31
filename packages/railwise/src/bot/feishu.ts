import crypto from "node:crypto"
import { Buffer } from "node:buffer"
import type {
  BotAdapter,
  BotMessageHandler,
  ExcelReport,
  IncomingMessage,
  OutgoingMessage,
} from "./types.js"

export interface FeishuAdapterOptions {
  appId?: string
  appSecret?: string
  verifyToken?: string
  encryptKey?: string
}

export class FeishuAdapter implements BotAdapter {
  readonly platform = "feishu" as const
  private handler?: BotMessageHandler
  private client?: unknown

  constructor(private readonly opts: FeishuAdapterOptions = {}) {}

  /**
   * Verify Feishu/Lark Event Signature
   */
  verifySignature(timestamp: string, nonce: string, body: string, signature: string): boolean {
    if (!this.opts.encryptKey) return true // Skip if key not configured
    
    try {
      const b = Buffer.from(body);
      const str = `${timestamp}${nonce}${this.opts.encryptKey}${b.toString('utf8')}`;
      const hmac = crypto.createHash('sha256');
      hmac.update(str);
      const computedSign = hmac.digest('hex');
      return computedSign === signature;
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

  async handle(raw: unknown, headers?: Record<string, string>, rawBody?: string) {
    // Validate signature if headers are provided
    if (headers && headers['x-lark-request-timestamp'] && headers['x-lark-request-nonce'] && headers['x-lark-signature'] && rawBody) {
      const ts = headers['x-lark-request-timestamp'];
      const nonce = headers['x-lark-request-nonce'];
      const sign = headers['x-lark-signature'];
      
      if (!this.verifySignature(ts, nonce, rawBody, sign)) {
        console.error("Feishu Webhook Signature Validation Failed");
        return;
      }
    }

    const msg = this.parse(raw)
    if (!msg || !this.handler) return
    await this.handler(msg)
  }

  private init() {
    return {
      appId: this.opts.appId,
      appSecret: this.opts.appSecret,
      verifyToken: this.opts.verifyToken,
      encryptKey: this.opts.encryptKey,
    }
  }

  private parse(raw: unknown): IncomingMessage | undefined {
    void raw
    return undefined
  }
}
