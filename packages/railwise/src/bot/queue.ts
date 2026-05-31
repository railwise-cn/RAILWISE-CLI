import type { IncomingMessage, BotAdapter } from "./types.js"

type TaskFn = () => Promise<void>

export class ConcurrencyQueue {
  private queue: TaskFn[] = []
  private activeCount = 0

  constructor(private readonly concurrencyLimit: number = 3) {}

  async enqueue(task: TaskFn): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          await task()
          resolve()
        } catch (e) {
          reject(e)
        } finally {
          this.activeCount--
          this.processNext()
        }
      }

      this.queue.push(wrappedTask)
      this.processNext()
    })
  }

  private processNext() {
    if (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const task = this.queue.shift()
      if (task) {
        this.activeCount++
        // Fire and forget, the wrappedTask handles its own resolution
        task().catch(console.error)
      }
    }
  }
}

export async function withRetry<T>(fn: () => Promise<T>, retries = 3, baseDelayMs = 1000): Promise<T> {
  let attempt = 0
  while (true) {
    try {
      return await fn()
    } catch (error) {
      attempt++
      if (attempt >= retries) {
        throw error
      }
      const delay = baseDelayMs * Math.pow(2, attempt - 1)
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }
}
