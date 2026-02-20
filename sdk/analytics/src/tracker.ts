import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { TrackerConfig, SkillEvent, CostInfo, CallerInfo, InvokeSpan } from './types'
import { EventBuffer } from './buffer'
import { Transport } from './transport'
import { AnalyticsExporter } from './export'

export class SkillsHubTracker {
  private readonly config: Required<TrackerConfig>
  private readonly buffer: EventBuffer
  private readonly events: SkillEvent[] = []

  constructor(config: TrackerConfig) {
    this.config = {
      skillId: config.skillId,
      endpoint: config.endpoint ?? 'http://127.0.0.1:19823',
      bufferSize: config.bufferSize ?? 100,
      flushIntervalMs: config.flushIntervalMs ?? 5000,
      fallbackPath: config.fallbackPath
        ?? path.join(os.homedir(), '.skillshub', 'analytics_buffer'),
      userId: config.userId ?? this.getOrCreateUserId(),
    }

    const transport = new Transport(this.config.endpoint, this.config.fallbackPath)
    this.buffer = new EventBuffer(transport, this.config.bufferSize, this.config.flushIntervalMs)
    this.buffer.start()
  }

  /**
   * Start tracking an invocation. Returns a span object to mark success/failure.
   *
   * Usage:
   *   const span = tracker.startInvoke({ sessionId: 'sess_123', inputHash: 'abc' })
   *   try {
   *     const result = await doWork()
   *     span.success(result)
   *   } catch (err) {
   *     span.fail(err)
   *   }
   */
  startInvoke(options: {
    sessionId: string
    inputHash?: string
    metadata?: Record<string, unknown>
    caller?: CallerInfo
  }): InvokeSpan {
    const startTime = Date.now()
    let costInfo: CostInfo | null = null
    let callerInfo: CallerInfo | null = options.caller ?? null

    const createEvent = (success: boolean, error: string | null): SkillEvent => ({
      event_type: 'skill_invoke',
      skill_id: this.config.skillId,
      timestamp: new Date().toISOString(),
      user_id: this.config.userId,
      session_id: options.sessionId,
      input_hash: options.inputHash ?? '',
      success,
      duration_ms: Date.now() - startTime,
      error,
      feedback_score: null,
      cost: costInfo,
      caller: callerInfo,
      metadata: options.metadata ?? {},
    })

    return {
      success: () => {
        this.buffer.push(createEvent(true, null))
      },
      fail: (error: Error | string) => {
        const errorMessage = error instanceof Error ? error.message : error
        this.buffer.push(createEvent(false, errorMessage))
      },
      setCost: (cost: CostInfo) => {
        costInfo = cost
      },
      setCaller: (caller: CallerInfo) => {
        callerInfo = caller
      },
    }
  }

  /**
   * Wrap an async function with automatic tracking.
   * Zero-invasion: the original function signature is preserved.
   *
   * Usage:
   *   const trackedFetch = tracker.wrap(fetchWeather)
   *   const result = await trackedFetch({ city: 'Beijing' })
   */
  wrap<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options?: {
      sessionId?: string
      hashInput?: (...args: TArgs) => string
      extractMetadata?: (...args: TArgs) => Record<string, unknown>
    },
  ): (...args: TArgs) => Promise<TResult> {
    return async (...args: TArgs): Promise<TResult> => {
      const sessionId = options?.sessionId ?? crypto.randomUUID()
      const inputHash = options?.hashInput
        ? this.hashString(options.hashInput(...args))
        : this.hashString(JSON.stringify(args))
      const metadata = options?.extractMetadata
        ? options.extractMetadata(...args)
        : {}

      const span = this.startInvoke({ sessionId, inputHash, metadata })

      try {
        const result = await fn(...args)
        span.success()
        return result
      } catch (error) {
        span.fail(error instanceof Error ? error : new Error(String(error)))
        throw error
      }
    }
  }

  /**
   * Submit user feedback for a skill invocation.
   */
  feedback(options: {
    sessionId: string
    score: 1 | -1
    metadata?: Record<string, unknown>
  }): void {
    const event: SkillEvent = {
      event_type: 'skill_feedback',
      skill_id: this.config.skillId,
      timestamp: new Date().toISOString(),
      user_id: this.config.userId,
      session_id: options.sessionId,
      input_hash: '',
      success: true,
      duration_ms: 0,
      error: null,
      feedback_score: options.score,
      cost: null,
      caller: null,
      metadata: options.metadata ?? {},
    }
    this.buffer.push(event)
  }

  /**
   * Flush all buffered events and stop the tracker.
   */
  async shutdown(): Promise<void> {
    await this.buffer.stop()
  }

  /**
   * Export all tracked events to a file
   */
  async exportEvents(format: 'json' | 'csv', outputPath?: string): Promise<{ filePath: string; eventCount: number }> {
    const result = await AnalyticsExporter.export(this.events, {
      format,
      outputPath,
    })
    return {
      filePath: result.filePath,
      eventCount: result.eventCount,
    }
  }

  /**
   * Get all tracked events (for custom export or analysis)
   */
  getEvents(): SkillEvent[] {
    return [...this.events]
  }

  private hashString(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 16)
  }

  private getOrCreateUserId(): string {
    const uidPath = path.join(os.homedir(), '.skillshub', 'analytics_uid')
    try {
      if (fs.existsSync(uidPath)) {
        return fs.readFileSync(uidPath, 'utf-8').trim()
      }
    } catch {
      // Fall through to create
    }

    const userId = `u_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
    try {
      fs.mkdirSync(path.dirname(uidPath), { recursive: true })
      fs.writeFileSync(uidPath, userId, 'utf-8')
    } catch {
      // Silently fail
    }
    return userId
  }
}