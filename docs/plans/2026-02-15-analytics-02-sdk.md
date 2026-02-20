# SDK: @skillshub/analytics TypeScript Package

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** 构建一个轻量级 TypeScript SDK，供 Skill 开发者在 Skill 代码中集成，自动采集调用事件并上报到 Skills Hub 的本地 Ingest Server。

**Architecture:** SDK 采用三层架构：Tracker（API 层）→ EventBuffer（内存缓冲）→ Transport（HTTP 上报 + 离线 fallback）。零外部依赖，仅使用 Node.js 内置模块。

**Tech Stack:** TypeScript, Node.js (http, fs, crypto 内置模块)

**并行说明:** 本模块与 01-backend、03-frontend 无依赖，可独立实施。SDK 上报的目标端口 `127.0.0.1:19823` 是与后端的共享契约，但 SDK 本身不依赖后端代码。

---

## Task 1: 初始化 SDK 项目结构

**Files:**
- Create: `sdk/analytics/package.json`
- Create: `sdk/analytics/tsconfig.json`
- Create: `sdk/analytics/src/index.ts`

**Step 1: 创建 package.json**

```json
{
  "name": "@skillshub/analytics",
  "version": "0.1.0",
  "description": "Lightweight analytics SDK for Skills Hub — track skill invocations transparently",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "test": "node --test dist/tests/"
  },
  "keywords": ["skills-hub", "analytics", "telemetry"],
  "license": "MIT",
  "devDependencies": {
    "typescript": "~5.9.3"
  }
}
```

**Step 2: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"]
}
```

**Step 3: 创建 src/index.ts（空入口）**

```typescript
export { SkillsHubTracker } from './tracker'
export type { TrackerConfig, SkillEvent, CostInfo, CallerInfo, InvokeSpan } from './types'
```

**Step 4: 验证目录结构**

Run: `ls -la sdk/analytics/`
Expected: 包含 `package.json`, `tsconfig.json`, `src/index.ts`

**Step 5: Commit**

```bash
git add sdk/analytics/
git commit -m "feat(sdk): initialize @skillshub/analytics package structure"
```

**🔍 检测点:** 目录结构正确
**✅ 验收标准:** `sdk/analytics/` 包含 `package.json`、`tsconfig.json`、`src/index.ts`

---

## Task 2: 定义类型 — types.ts

**Files:**
- Create: `sdk/analytics/src/types.ts`

**Step 1: 创建 types.ts**

```typescript
export interface TrackerConfig {
  /** Skill ID assigned by Skills Hub during installation */
  skillId: string
  /** Ingest server endpoint (default: http://127.0.0.1:19823) */
  endpoint?: string
  /** Max events to buffer before auto-flush (default: 100) */
  bufferSize?: number
  /** Auto-flush interval in milliseconds (default: 5000) */
  flushIntervalMs?: number
  /** Directory for offline event storage (default: ~/.skillshub/analytics_buffer/) */
  fallbackPath?: string
  /** User ID — auto-generated if not provided */
  userId?: string
}

export interface SkillEvent {
  event_type: 'skill_invoke' | 'skill_feedback' | 'skill_error'
  skill_id: string
  timestamp: string
  user_id: string
  session_id: string
  input_hash: string
  success: boolean
  duration_ms: number
  error: string | null
  feedback_score: number | null
  cost: CostInfo | null
  caller: CallerInfo | null
  metadata: Record<string, unknown>
}

export interface CostInfo {
  token_input: number
  token_output: number
  api_cost_usd: number
}

export interface CallerInfo {
  agent_id: string
  workflow_id: string | null
  tool_key: string
}

export interface InvokeSpan {
  /** Mark the invocation as successful */
  success: (result?: unknown) => void
  /** Mark the invocation as failed */
  fail: (error: Error | string) => void
  /** Attach cost information to this invocation */
  setCost: (cost: CostInfo) => void
  /** Attach caller information */
  setCaller: (caller: CallerInfo) => void
}

export interface IngestRequestBody {
  events: SkillEvent[]
}
```

**Step 2: Commit**

```bash
git add sdk/analytics/src/types.ts
git commit -m "feat(sdk): define analytics event types and interfaces"
```

**🔍 检测点:** 类型定义完整
**✅ 验收标准:**
- `SkillEvent` 包含所有 13 个字段
- `CostInfo` 包含 token_input/token_output/api_cost_usd
- `CallerInfo` 包含 agent_id/workflow_id/tool_key
- `InvokeSpan` 提供 success/fail/setCost/setCaller 方法

---

## Task 3: 实现 Transport 层 — transport.ts

**Files:**
- Create: `sdk/analytics/src/transport.ts`

**Step 1: 创建 transport.ts**

```typescript
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
```

**Step 2: Commit**

```bash
git add sdk/analytics/src/transport.ts
git commit -m "feat(sdk): implement HTTP transport with offline fallback"
```

**🔍 检测点:** 文件创建成功
**✅ 验收标准:**
- `send()` 通过 HTTP POST 发送到 `127.0.0.1:19823/v1/events`
- 网络失败时自动写入 `~/.skillshub/analytics_buffer/pending_events_*.jsonl`
- `drainFallback()` 可读取并重新发送离线事件
- 5 秒超时保护
- 所有异常静默处理，不影响 Skill 业务逻辑

---

## Task 4: 实现 EventBuffer — buffer.ts

**Files:**
- Create: `sdk/analytics/src/buffer.ts`

**Step 1: 创建 buffer.ts**

```typescript
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
```

**Step 2: Commit**

```bash
git add sdk/analytics/src/buffer.ts
git commit -m "feat(sdk): implement event buffer with auto-flush"
```

**🔍 检测点:** 文件创建成功
**✅ 验收标准:**
- `push()` 添加事件到缓冲区
- 缓冲区满（默认 100 条）时自动 flush
- 定时器每 5 秒自动 flush
- `stop()` 清理定时器并 flush 剩余事件
- 启动时自动 drain 离线缓冲

---

## Task 5: 实现核心 Tracker — tracker.ts

**Files:**
- Create: `sdk/analytics/src/tracker.ts`

**Step 1: 创建 tracker.ts**

```typescript
import * as crypto from 'node:crypto'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import type { TrackerConfig, SkillEvent, CostInfo, CallerInfo, InvokeSpan } from './types'
import { EventBuffer } from './buffer'
import { Transport } from './transport'

export class SkillsHubTracker {
  private readonly config: Required<TrackerConfig>
  private readonly buffer: EventBuffer

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
```

**Step 2: Commit**

```bash
git add sdk/analytics/src/tracker.ts
git commit -m "feat(sdk): implement SkillsHubTracker with startInvoke, wrap, and feedback"
```

**🔍 检测点:** 文件创建成功
**✅ 验收标准:**
- `startInvoke()` 返回 `InvokeSpan`，可调用 `success()`/`fail()`/`setCost()`/`setCaller()`
- `wrap()` 可包装任意 async 函数，自动计时和上报
- `feedback()` 可提交 👍/👎 反馈
- `shutdown()` 清理资源
- User ID 自动生成并持久化到 `~/.skillshub/analytics_uid`
- Input hash 使用 SHA-256 前 16 位

---

## Task 6: 创建 autoTracker 便捷入口

**Files:**
- Create: `sdk/analytics/src/auto.ts`
- Modify: `sdk/analytics/src/index.ts`

**Step 1: 创建 auto.ts**

```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'
import { SkillsHubTracker } from './tracker'

interface AnalyticsConfig {
  skill_id: string
  analytics_endpoint?: string
}

/**
 * Auto-configure a tracker by reading analytics.config.json from the skill directory.
 * Skills Hub injects this file during skill installation.
 *
 * Usage in a skill:
 *   import { createAutoTracker } from '@skillshub/analytics'
 *   const tracker = createAutoTracker(__dirname)
 *   export default tracker.wrap(mySkillFunction)
 */
export function createAutoTracker(skillDir: string): SkillsHubTracker {
  const configPath = path.join(skillDir, 'analytics.config.json')

  let config: AnalyticsConfig
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    config = JSON.parse(raw)
  } catch {
    throw new Error(
      `[skillshub/analytics] Cannot read ${configPath}. ` +
      `Ensure this skill was installed via Skills Hub.`
    )
  }

  return new SkillsHubTracker({
    skillId: config.skill_id,
    endpoint: config.analytics_endpoint,
  })
}
```

**Step 2: 更新 index.ts 导出**

```typescript
export { SkillsHubTracker } from './tracker'
export { createAutoTracker } from './auto'
export type { TrackerConfig, SkillEvent, CostInfo, CallerInfo, InvokeSpan } from './types'
```

**Step 3: 验证编译**

Run: `cd sdk/analytics && npx tsc --noEmit 2>&1`
Expected: 无错误

**Step 4: Commit**

```bash
git add sdk/analytics/src/auto.ts sdk/analytics/src/index.ts
git commit -m "feat(sdk): add createAutoTracker for zero-config skill integration"
```

**🔍 检测点:** `npx tsc --noEmit` 通过
**✅ 验收标准:**
- `createAutoTracker(__dirname)` 可从 `analytics.config.json` 自动创建 tracker
- 配置文件不存在时抛出有意义的错误信息
- `index.ts` 导出所有公共 API

---

## Task 7: 构建验证

**Step 1: 安装依赖并构建**

Run: `cd sdk/analytics && npm install && npm run build 2>&1`
Expected: 编译成功，`dist/` 目录包含 `.js` 和 `.d.ts` 文件

**Step 2: 检查产物**

Run: `ls sdk/analytics/dist/`
Expected: `index.js`, `index.d.ts`, `tracker.js`, `tracker.d.ts`, `buffer.js`, `transport.js`, `types.js`, `auto.js` 等

**Step 3: Commit**

```bash
git add sdk/analytics/
git commit -m "feat(sdk): verify build output for @skillshub/analytics"
```

**🔍 检测点:** `npm run build` 成功
**✅ 验收标准:**
- `dist/` 目录包含所有编译产物
- `.d.ts` 类型声明文件完整
- 无 TypeScript 编译错误

---

## 最终验收清单

| # | 检查项 | 命令 |
|---|--------|------|
| 1 | package.json 正确 | `cat sdk/analytics/package.json` |
| 2 | TypeScript 编译通过 | `cd sdk/analytics && npx tsc --noEmit` |
| 3 | 构建产物完整 | `ls sdk/analytics/dist/` |
| 4 | 导出 API 完整 | `grep export sdk/analytics/src/index.ts` |
| 5 | 零外部依赖 | `cat sdk/analytics/package.json \| grep dependencies` |
| 6 | Transport 有离线 fallback | `grep fallback sdk/analytics/src/transport.ts` |
| 7 | Tracker 有 wrap/startInvoke/feedback | `grep -E 'wrap|startInvoke|feedback' sdk/analytics/src/tracker.ts` |
