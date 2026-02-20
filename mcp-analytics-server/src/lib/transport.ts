import * as http from 'node:http'
import type { SkillEvent, IngestRequestBody } from './types.js'

export type { SkillEvent }

const DEFAULT_ENDPOINT = 'http://127.0.0.1:19823'
const EVENTS_PATH = '/v1/events'

export class Transport {
  private readonly endpoint: string

  constructor(endpoint?: string) {
    this.endpoint = endpoint ?? DEFAULT_ENDPOINT
  }

  async send(events: SkillEvent[]): Promise<boolean> {
    if (events.length === 0) return true

    const body: IngestRequestBody = { events }
    const payload = JSON.stringify(body)

    return this.httpPost(payload)
  }

  async query(path: string, queryParams?: Record<string, string>): Promise<unknown> {
    const url = new URL(path, this.endpoint)
    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        url.searchParams.append(key, value)
      })
    }

    return this.httpGet(url.toString())
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

  private httpGet(url: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url)

      const options: http.RequestOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port,
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
        timeout: 5000,
      }

      const request = http.request(options, (response) => {
        let responseBody = ''
        response.on('data', (chunk: Buffer) => { responseBody += chunk.toString() })
        response.on('end', () => {
          const statusCode = response.statusCode ?? 0
          if (statusCode >= 200 && statusCode < 300) {
            try {
              const data = JSON.parse(responseBody)
              resolve(data)
            } catch {
              resolve(responseBody)
            }
          } else {
            reject(new Error(`HTTP ${statusCode}: ${responseBody}`))
          }
        })
      })

      request.on('error', reject)
      request.on('timeout', () => {
        request.destroy()
        reject(new Error('Request timeout'))
      })

      request.end()
    })
  }
}
