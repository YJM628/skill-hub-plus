import * as http from 'node:http'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { SkillEvent, IngestRequestBody } from './types'

const DEFAULT_ENDPOINT = 'http://127.0.0.1:19823'
const EVENTS_PATH = '/v1/events'

export class Transport {
  private readonly endpoint: string
  private readonly fallbackDir: string

  constructor(endpoint?: string, fallbackPath?: string) {
    this.endpoint = endpoint ?? DEFAULT_ENDPOINT
    this.fallbackDir = fallbackPath
      ?? path.join(os.homedir(), '.skillshub', 'analytics_buffer')
  }

  /**
   * Send events to the ingest server via HTTP POST.
   * On failure, persist events to the fallback directory.
   */
  async send(events: SkillEvent[]): Promise<boolean> {
    if (events.length === 0) return true

    const body: IngestRequestBody = { events }
    const payload = JSON.stringify(body)

    try {
      const success = await this.httpPost(payload)
      if (success) {
        return true
      }
    } catch {
      // Network error — fall through to fallback
    }

    this.persistToFallback(events)
    return false
  }

  /**
   * Attempt to flush any previously persisted fallback events.
   * Called on successful connection to drain the offline buffer.
   */
  async drainFallback(): Promise<number> {
    if (!fs.existsSync(this.fallbackDir)) return 0

    const files = fs.readdirSync(this.fallbackDir)
      .filter(f => f.startsWith('pending_events_') && f.endsWith('.jsonl'))
      .sort()

    let drained = 0

    for (const file of files) {
      const filePath = path.join(this.fallbackDir, file)
      try {
        const content = fs.readFileSync(filePath, 'utf-8')
        const events: SkillEvent[] = content
          .split('\n')
          .filter(line => line.trim().length > 0)
          .map(line => JSON.parse(line))

        if (events.length === 0) {
          fs.unlinkSync(filePath)
          continue
        }

        const success = await this.send(events)
        if (success) {
          fs.unlinkSync(filePath)
          drained += events.length
        }
      } catch {
        // Skip corrupted files
        continue
      }
    }

    return drained
  }

  private httpPost(payload: string): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const url = new URL(EVENTS_PATH, this.endpoint)

      const options: http.RequestOptions = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      }

      const request = http.request(options, (response) => {
        let responseBody = ''
        response.on('data', (chunk: Buffer) => { responseBody += chunk.toString() })
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0
          if (statusCode >= 200 && statusCode < 300) {
            resolve(true)
          } else {
            resolve(false)
          }
        })
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('Request timeout'))
      })

      request.write(payload)
      request.end()
    })
  }

  private persistToFallback(events: SkillEvent[]): void {
    try {
      fs.mkdirSync(this.fallbackDir, { recursive: true })
      const timestamp = Date.now()
      const fileName = `pending_events_${timestamp}.jsonl`
      const filePath = path.join(this.fallbackDir, fileName)
      const content = events.map(e => JSON.stringify(e)).join('\n') + '\n'
      fs.writeFileSync(filePath, content, 'utf-8')
    } catch {
      // Silently fail — analytics should never break the skill
    }
  }
}
