import type { SkillEvent } from './types'
import { Transport } from './transport'

const DEFAULT_BUFFER_SIZE = 100
const DEFAULT_FLUSH_INTERVAL_MS = 5000

export class EventBuffer {
  private events: SkillEvent[] = []
  private readonly maxSize: number
  private readonly flushIntervalMs: number
  private readonly transport: Transport
  private flushTimer: ReturnType<typeof setInterval> | null = null

  constructor(
    transport: Transport,
    maxSize?: number,
    flushIntervalMs?: number,
  ) {
    this.transport = transport
    this.maxSize = maxSize ?? DEFAULT_BUFFER_SIZE
    this.flushIntervalMs = flushIntervalMs ?? DEFAULT_FLUSH_INTERVAL_MS
  }

  /** Start the auto-flush timer */
  start(): void {
    if (this.flushTimer) return
    this.flushTimer = setInterval(() => {
      void this.flush()
    }, this.flushIntervalMs)

    // Drain any offline fallback events on startup
    void this.transport.drainFallback()
  }

  /** Stop the auto-flush timer and flush remaining events */
  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    await this.flush()
  }

  /** Add an event to the buffer; auto-flush if buffer is full */
  push(event: SkillEvent): void {
    this.events.push(event)
    if (this.events.length >= this.maxSize) {
      void this.flush()
    }
  }

  /** Flush all buffered events to the transport */
  async flush(): Promise<void> {
    if (this.events.length === 0) return

    const batch = this.events.splice(0)
    await this.transport.send(batch)
  }

  /** Get current buffer size (for testing/debugging) */
  get size(): number {
    return this.events.length
  }
}
