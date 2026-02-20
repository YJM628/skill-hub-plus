
# Analytics MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** Build an MCP Server that enables Claude AI to directly track skill invocations, query analytics data, and export reports without requiring users to write code.

**Architecture:** 
- MCP Server (TypeScript/Node.js) exposes 5 tools via stdio protocol
- Reuses existing SDK transport layer for HTTP communication with ingest server
- Extends backend ingest server with HTTP query endpoints for data retrieval
- Zero-code integration for Claude users

**Tech Stack:** 
- TypeScript/Node.js for MCP Server
- @modelcontextprotocol/sdk for MCP protocol
- Rust (tiny_http) for backend query endpoints
- SQLite for data persistence

---

## Phase 1: Backend HTTP Query API

### Task 1: Add HTTP Query Endpoints to Ingest Server

**Files:**
- Modify: `src-tauri/src/core/analytics_ingest.rs:50-180`

**Step 1: Add GET method handling and query endpoints**

Insert after line 52 (after `path` and `method` extraction):

```rust
// Handle GET requests for analytics queries
if method == "GET" && path.starts_with("/v1/analytics/") {
    let query_path = path.strip_prefix("/v1/analytics/").unwrap();
    let request_url = request.url().parse::<url::Url>().unwrap_or_else(|_| {
        url::Url::parse(&format!("http://{}{}", INGEST_ADDR, path)).unwrap()
    });
    
    let response_body = match query_path {
        "overview" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(7);
            serde_json::to_string(&store.get_overview(days).unwrap_or_else(|_| {
                crate::core::analytics_store::AnalyticsOverview::default()
            }))
        }
        "top_skills" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(7);
            let limit = request_url.query_pairs()
                .find(|(k, _)| k == "limit")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(10);
            serde_json::to_string(&store.get_top_skills(days, limit).unwrap_or_default())
        }
        "daily_trend" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(30);
            serde_json::to_string(&store.get_daily_trend(days).unwrap_or_default())
        }
        "success_rate" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(30);
            let skill_id = request_url.query_pairs()
                .find(|(k, _)| k == "skill_id")
                .map(|(_, v)| v.to_string());
            serde_json::to_string(&store.get_success_rate_trend(skill_id.as_deref(), days).unwrap_or_default())
        }
        "cost_summary" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(30);
            serde_json::to_string(&store.get_cost_summary(days).unwrap_or_default())
        }
        "caller_analysis" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(30);
            serde_json::to_string(&store.get_caller_analysis(days).unwrap_or_default())
        }
        "user_retention" => {
            let days = request_url.query_pairs()
                .find(|(k, _)| k == "days")
                .and_then(|(_, v)| v.parse::<i64>().ok())
                .unwrap_or(30);
            serde_json::to_string(&store.get_user_retention(days).unwrap_or_default())
        }
        "alerts" => {
            serde_json::to_string(&store.get_active_alerts().unwrap_or_default())
        }
        _ => {
            let response = tiny_http::Response::from_string("Not Found")
                .with_status_code(404);
            let _ = request.respond(response);
            continue;
        }
    };

    let response = tiny_http::Response::from_string(response_body.unwrap())
        .with_status_code(200)
        .with_header(
            "Content-Type: application/json"
                .parse::<tiny_http::Header>()
                .unwrap(),
        );
    let _ = request.respond(response);
    continue;
}
```

**Step 2: Add url dependency to Cargo.toml**

File: `src-tauri/Cargo.toml`
Add to `[dependencies]` section:

```toml
url = "2.5"
```

**Step 3: Run cargo check**

Run: `cd src-tauri && cargo check 2>&1 | tail -10`
Expected: `Checking app v0.2.0 (...)` followed by `Finished`

**Step 4: Test query endpoints manually**

Run: `curl -s http://127.0.0.1:19823/v1/analytics/overview?days=7 | head -20`
Expected: JSON response with analytics overview data

**Step 5: Commit**

```bash
git add src-tauri/src/core/analytics_ingest.rs src-tauri/Cargo.toml
git commit -m "feat(analytics): add HTTP query endpoints (overview, top_skills, daily_trend, success_rate, cost_summary, caller_analysis, user_retention, alerts)"
```

**🔍 检测点:** `cargo check` passes; `curl http://127.0.0.1:19823/v1/analytics/overview` returns JSON
**✅ 验收标准:**
- GET /v1/analytics/overview?days=N returns overview data
- GET /v1/analytics/top_skills?days=N&limit=M returns top skills
- GET /v1/analytics/daily_trend?days=N returns daily trend
- All endpoints return valid JSON with 200 status
- Invalid endpoints return 404

---

## Phase 2: MCP Server Project Structure

### Task 2: Create MCP Server Project Structure

**Files:**
- Create: `mcp-analytics-server/package.json`
- Create: `mcp-analytics-server/tsconfig.json`
- Create: `mcp-analytics-server/README.md`

**Step 1: Create package.json**

```json
{
  "name": "@skillshub/mcp-analytics",
  "version": "1.0.0",
  "description": "Skills Hub Analytics MCP Server - Enable Claude AI to track and query analytics without code",
  "type": "module",
  "main": "dist/index.js",
  "bin": {
    "skillshub-analytics-mcp": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.0.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "node",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create README.md**

```markdown
# @skillshub/mcp-analytics

MCP Server for Skills Hub Analytics - Enable Claude AI to directly track skill invocations and query analytics data.

## Features

- **track_skill_invoke**: Track skill execution with timing, success/failure, cost
- **track_user_feedback**: Record user 👍/👎 feedback
- **query_analytics**: Query analytics data (overview, trends, top skills, etc.)
- **export_analytics_data**: Export data to JSON or CSV files
- **get_analytics_overview**: Quick overview of key metrics

## Installation

1. Build the MCP Server:
```bash
cd mcp-analytics-server
npm install
npm run build
```

2. Configure Claude Desktop:

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "skills-hub-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-analytics-server/dist/index.js"],
      "env": {
        "ANALYTICS_ENDPOINT": "http://127.0.0.1:19823"
      }
    }
  }
}
```

3. Restart Claude Desktop

## Usage

Ask Claude:
- "Track this API call: skill_id=weather, duration=1.5s, success=true"
- "Show me analytics overview for the past 7 days"
- "Export last month's data to CSV"

## Requirements

- Skills Hub app running (provides ingest server on 127.0.0.1:19823)
- Node.js >= 18.0.0
```

**Step 4: Create .gitignore**

```bash
node_modules/
dist/
*.log
.DS_Store
```

**Step 5: Commit**

```bash
git add mcp-analytics-server/
git commit -m "feat(mcp): create MCP server project structure with package.json, tsconfig, and README"
```

**🔍 检测点:** Files created; `git status` shows new files
**✅ 验收标准:**
- `package.json` contains correct dependencies and scripts
- `tsconfig.json` targets ES2022 with strict mode
- `README.md` describes installation and usage
- `.gitignore` excludes node_modules and dist

---

### Task 3: Create Shared Types and Transport Layer

**Files:**
- Create: `mcp-analytics-server/src/lib/types.ts`
- Create: `mcp-analytics-server/src/lib/transport.ts`

**Step 1: Create types.ts**

```typescript
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
  token_input: number | null
  token_output: number | null
  api_cost_usd: number | null
}

export interface CallerInfo {
  agent_id: string | null
  workflow_id: string | null
  tool_key: string | null
}

export interface IngestRequestBody {
  events: SkillEvent[]
}

export interface QueryParams {
  query_type: 'overview' | 'daily_trend' | 'top_skills' | 'success_rate' | 'cost_summary' | 'caller_analysis' | 'user_retention'
  skill_id?: string
  days?: number
  limit?: number
}

export interface ExportParams {
  format: 'json' | 'csv'
  output_path?: string
  date_range?: {
    start: string
    end: string
  }
  skill_id?: string
}
```

**Step 2: Create transport.ts**

```typescript
import * as http from 'node:http'
import type { SkillEvent, IngestRequestBody } from './types'

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
```

**Step 3: Run TypeScript check**

Run: `cd mcp-analytics-server && npx tsc --noEmit 2>&1`
Expected: No errors

**Step 4: Commit**

```bash
git add mcp-analytics-server/src/lib/
git commit -m "feat(mcp): add shared types and HTTP transport layer"
```

**🔍 检测点:** `npx tsc --noEmit` passes
**✅ 验收标准:**
- `types.ts` exports all required interfaces
- `Transport.send()` POSTs to /v1/events
- `Transport.query()` GETs from query endpoints
- Proper error handling and timeout

---

## Phase 3: MCP Tool Implementations

### Task 4: Implement track_skill_invoke Tool

**Files:**
- Create: `mcp-analytics-server/src/tools/trackInvoke.ts`

**Step 1: Create trackInvoke.ts**

```typescript
import { randomUUID } from 'crypto'
import { Transport, SkillEvent } from '../lib/transport.js'

export const definition = {
  name: "track_skill_invoke",
  description: "Track a skill invocation event, recording execution time, success/failure status, and cost information",
  inputSchema: {
    type: "object",
    properties: {
      skill_id: { 
        type: "string", 
        description: "The ID of the skill being invoked" 
      },
      session_id: { 
        type: "string", 
        description: "Unique session identifier for this invocation" 
      },
      success: { 
        type: "boolean", 
        description: "Whether the invocation succeeded" 
      },
      duration_ms: { 
        type: "number", 
        description: "Execution duration in milliseconds" 
      },
      error: { 
        type: "string", 
        description: "Error message if the invocation failed" 
      },
      cost: {
        type: "object",
        description: "Cost information for the invocation",
        properties: {
          token_input: { type: "number" },
          token_output: { type: "number" },
          api_cost_usd: { type: "number" }
        }
      },
      metadata: {
        type: "object",
        description: "Custom metadata for the event"
      }
    },
    required: ["skill_id", "session_id", "success", "duration_ms"]
  }
}

export async function handler(args: any) {
  const { skill_id, session_id, success, duration_ms, error, cost, metadata } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)
  
  const event: SkillEvent = {
    event_type: 'skill_invoke',
    skill_id,
    timestamp: new Date().toISOString(),
    user_id: 'mcp_user',
    session_id,
    input_hash: randomUUID().slice(0, 16),
    success,
    duration_ms,
    error: error || null,
    feedback_score: null,
    cost: cost ? {
      token_input: cost.token_input || null,
      token_output: cost.token_output || null,
      api_cost_usd: cost.api_cost_usd || null
    } : null,
    caller: null,
    metadata: metadata || {}
  }

  const result = await transport.send([event])

  return {
    content: [
      {
        type: "text",
        text: result 
          ? `✅ Successfully tracked skill invocation: ${skill_id} (session: ${session_id}, success: ${success}, duration: ${duration_ms}ms)`
          : `❌ Failed to track invocation - please ensure Skills Hub app is running and ingest server is accessible at ${endpoint}`,
      },
    ],
  }
}
```

**Step 2: Commit**

```bash
git add mcp-analytics-server/src/tools/trackInvoke.ts
git commit -m "feat(mcp): implement track_skill_invoke tool"
```

**🔍 检测点:** File created; TypeScript compiles
**✅ 验收标准:**
- Tool definition matches MCP schema
- Handler creates SkillEvent with all required fields
- Returns success/failure message
- Uses ANALYTICS_ENDPOINT env var

---

### Task 5: Implement track_user_feedback Tool

**Files:**
- Create: `mcp-analytics-server/src/tools/trackFeedback.ts`

**Step 1: Create trackFeedback.ts**

```typescript
import { Transport, SkillEvent } from '../lib/transport.js'

export const definition = {
  name: "track_user_feedback",
  description: "Record user feedback (👍/👎) for a skill invocation",
  inputSchema: {
    type: "object",
    properties: {
      skill_id: { 
        type: "string", 
        description: "The ID of the skill" 
      },
      session_id: { 
        type: "string", 
        description: "Session ID of the invocation being rated" 
      },
      score: { 
        type: "number", 
        enum: [1, -1],
        description: "Feedback score: 1 for 👍 (positive), -1 for 👎 (negative)" 
      },
      metadata: {
        type: "object",
        description: "Custom metadata for the feedback"
      }
    },
    required: ["skill_id", "session_id", "score"]
  }
}

export async function handler(args: any) {
  const { skill_id, session_id, score, metadata } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)
  
  const event: SkillEvent = {
    event_type: 'skill_feedback',
    skill_id,
    timestamp: new Date().toISOString(),
    user_id: 'mcp_user',
    session_id,
    input_hash: '',
    success: true,
    duration_ms: 0,
    error: null,
    feedback_score: score,
    cost: null,
    caller: null,
    metadata: metadata || {}
  }

  const result = await transport.send([event])

  const emoji = score === 1 ? '👍' : '👎'

  return {
    content: [
      {
        type: "text",
        text: result 
          ? `✅ Recorded user feedback ${emoji} for skill: ${skill_id} (session: ${session_id})`
          : `❌ Failed to record feedback - please ensure Skills Hub app is running`,
      },
    ],
  }
}
```

**Step 2: Commit**

```bash
git add mcp-analytics-server/src/tools/trackFeedback.ts
git commit -m "feat(mcp): implement track_user_feedback tool"
```

**🔍 检测点:** File created; TypeScript compiles
**✅ 验收标准:**
- Accepts score 1 or -1 only
- Creates skill_feedback event type
- Returns emoji in success message

---

### Task 6: Implement query_analytics Tool

**Files:**
- Create: `mcp-analytics-server/src/tools/queryAnalytics.ts`

**Step 1: Create queryAnalytics.ts**

```typescript
import { Transport } from '../lib/transport.js'

export const definition = {
  name: "query_analytics",
  description: "Query analytics data with various dimensions and filters",
  inputSchema: {
    type: "object",
    properties: {
      query_type: {
        type: "string",
        enum: ["overview", "daily_trend", "top_skills", "success_rate", "cost_summary", "caller_analysis", "user_retention"],
        description: "Type of analytics query to execute"
      },
      skill_id: {
        type: "string",
        description: "Optional skill ID to filter results"
      },
      days: {
        type: "number",
        description: "Number of days to include in the query",
        default: 7
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return",
        default: 10
      }
    },
    required: ["query_type"]
  }
}

export async function handler(args: any) {
  const { query_type, skill_id, days = 7, limit = 10 } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  const queryParams: Record<string, string> = {
    days: days.toString()
  }

  if (limit) {
    queryParams.limit = limit.toString()
  }

  if (skill_id) {
    queryParams.skill_id = skill_id
  }

  try {
    const data = await transport.query(`/v1/analytics/${query_type}`, queryParams)
    
    return {
      content: [
        {
          type: "text",
          text: formatQueryResult(query_type, data, days)
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to query analytics: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function formatQueryResult(queryType: string, data: unknown, days: number): string {
  const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
  
  const descriptions: Record<string, string> = {
    overview: `📊 Analytics Overview (Past ${days} days)`,
    daily_trend: `📈 Daily Trend (Past ${days} days)`,
    top_skills: `🏆 Top Skills (Past ${days} days)`,
    success_rate: `✅ Success Rate Trend (Past ${days} days)`,
    cost_summary: `💰 Cost Summary (Past ${days} days)`,
    caller_analysis: `🔗 Caller Analysis (Past ${days} days)`,
    user_retention: `👥 User Retention (Past ${days} days)`
  }

  return `${descriptions[queryType] || queryType}\n\n\`\`\`json\n${dataStr}\n\`\`\``
}
```

**Step 2: Commit**

```bash
git add mcp-analytics-server/src/tools/queryAnalytics.ts
git commit -m "feat(mcp): implement query_analytics tool"
```

**🔍 检测点:** File created; TypeScript compiles
**✅ 验收标准:**
- Supports all 7 query types
- Accepts optional skill_id, days, limit parameters
- Formats output with emoji headers
- Handles errors gracefully

---

### Task 7: Implement get_analytics_overview Tool

**Files:**
- Create: `mcp-analytics-server/src/tools/getOverview.ts`

**Step 1: Create getOverview.ts**

```typescript
import { Transport } from '../lib/transport.js'

export const definition = {
  name: "get_analytics_overview",
  description: "Get a quick analytics overview with key metrics like total calls, active users, success rate, and average response time",
  inputSchema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        description: "Number of days to include in the overview",
        default: 7
      }
    }
  }
}

export async function handler(args: any) {
  const { days = 7 } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  try {
    const data = await transport.query('/v1/analytics/overview', { days: days.toString() })
    
    return {
      content: [
        {
          type: "text",
          text: formatOverview(data, days)
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to get analytics overview: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function formatOverview(data: unknown, days: number): string {
  const overview = data as any
  
  return `📊 Analytics Overview (Past ${days} days)

**Key Metrics:**
- Total Calls: ${overview.total_calls?.toLocaleString() || 'N/A'}
- Active Users: ${overview.active_users?.toLocaleString() || 'N/A'}
- Success Rate: ${overview.success_rate ? `${(overview.success_rate * 100).toFixed(1)}%` : 'N/A'}
- Avg Response Time: ${overview.avg_duration_ms ? `${overview.avg_duration_ms.toFixed(0)}ms` : 'N/A'}
- Total Cost: ${overview.total_cost_usd ? `$${overview.total_cost_usd.toFixed(4)}` : 'N/A'}

**Top Skills:**
${overview.top_skills?.slice(0, 5).map((s: any) => 
  `- ${s.skill_id}: ${s.call_count} calls (${(s.success_rate * 100).toFixed(1)}% success)`
).join('\n') || 'No data available'}
`
}
```

**Step 2: Commit**

```bash
git add mcp-analytics-server/src/tools/getOverview.ts
git commit -m "feat(mcp): implement get_analytics_overview tool"
```

**🔍 检测点:** File created; TypeScript compiles
**✅ 验收标准:**
- Returns formatted overview with key metrics
- Shows top 5 skills with call counts and success rates
- Human-readable formatting with emoji

---

### Task 8: Implement export_analytics_data Tool

**Files:**
- Create: `mcp-analytics-server/src/tools/exportData.ts`

**Step 1: Create exportData.ts**

```typescript
import * as fs from 'node:fs'
import * as path from 'node:path'
import { Transport } from '../lib/transport.js'

export const definition = {
  name: "export_analytics_data",
  description: "Export analytics data to a file in JSON or CSV format",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["json", "csv"],
        description: "Export format"
      },
      output_path: {
        type: "string",
        description: "Output file path (optional, defaults to current directory)"
      },
      date_range: {
        type: "object",
        description: "Date range filter",
        properties: {
          start: { type: "string", format: "date-time" },
          end: { type: "string", format: "date-time" }
        }
      },
      skill_id: {
        type: "string",
        description: "Optional skill ID to filter"
      }
    },
    required: ["format"]
  }
}

export async function handler(args: any) {
  const { format, output_path, date_range, skill_id } = args
  
  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  try {
    // Query all relevant data
    const overview = await transport.query('/v1/analytics/overview', { days: '30' })
    const dailyTrend = await transport.query('/v1/analytics/daily_trend', { days: '30' })
    const topSkills = await transport.query('/v1/analytics/top_skills', { days: '30', limit: '50' })
    const costSummary = await transport.query('/v1/analytics/cost_summary', { days: '30' })

    const exportData = {
      export_timestamp: new Date().toISOString(),
      date_range: date_range || { start: null, end: null },
      skill_filter: skill_id || null,
      overview,
      daily_trend: dailyTrend,
      top_skills: topSkills,
      cost_summary: costSummary
    }

    // Determine output path
    const defaultPath = `analytics_export_${Date.now()}.${format}`
    const finalPath = output_path || path.join(process.cwd(), defaultPath)

    // Write file
    if (format === 'json') {
      fs.writeFileSync(finalPath, JSON.stringify(exportData, null, 2), 'utf-8')
    } else {
      const csvContent = convertToCSV(exportData)
      fs.writeFileSync(finalPath, csvContent, 'utf-8')
    }

    return {
      content: [
        {
          type: "text",
          text: `📊 Analytics data exported successfully!\n\n` +
                `**Format:** ${format.toUpperCase()}\n` +
                `**File:** ${finalPath}\n` +
                `**Size:** ${fs.statSync(finalPath).size.toLocaleString()} bytes\n\n` +
                `You can now open this file in your preferred tool for further analysis.`
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to export analytics data: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function convertToCSV(data: any): string {
  const lines: string[] = []

  // Overview section
  lines.push('# Overview')
  lines.push(`Total Calls,${data.overview.total_calls || 0}`)
  lines.push(`Active Users,${data.overview.active_users || 0}`)
  lines.push(`Success Rate,${data.overview.success_rate ? (data.overview.success_rate * 100).toFixed(2) : 'N/A'}%`)
  lines.push(`Avg Duration (ms),${data.overview.avg_duration_ms || 0}`)
  lines.push(`Total Cost (USD),${data.overview.total_cost_usd || 0}`)
  lines.push('')

  // Top Skills section
  lines.push('# Top Skills')
  lines.push('Skill ID,Call Count,Success Rate,Avg Duration (ms),Total Cost (USD)')
  if (data.top_skills && Array.isArray(data.top_skills)) {
    data.top_skills.forEach((skill: any) => {
      lines.push(
        `${skill.skill_id},` +
        `${skill.call_count},` +
        `${(skill.success_rate * 100).toFixed(2)}%,` +
        `${skill.avg_duration_ms || 0},` +
        `${skill.total_cost_usd || 0}`
      )
    })
  }

  return lines.join('\n')
}
```

**Step 2: Commit**

```bash
git add mcp-analytics-server/src/tools/exportData.ts
git commit -m "feat(mcp): implement export_analytics_data tool"
```

**🔍 检测点:** File created; TypeScript compiles
**✅ 验收标准:**
- Exports JSON with all analytics data
- Exports CSV with tabular format
- Creates file at specified or default path
- Returns file size and path

---

## Phase 4: MCP Server Entry Point

### Task 9: Create MCP Server Main Entry Point

**Files:**
- Create: `mcp-analytics-server/src/index.ts`

**Step 1: Create index.ts**

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js"
import { trackSkillInvoke } from "./tools/trackInvoke.js"
import { trackUserFeedback } from "./tools/trackFeedback.js"
import { queryAnalytics } from "./tools/queryAnalytics.js"
import { exportAnalyticsData } from "./tools/exportData.js"
import { getAnalyticsOverview } from "./tools/getOverview.js"

const server = new Server(
  {
    name: "skills-hub-analytics",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      trackSkillInvoke.definition,
      trackUserFeedback.definition,
      queryAnalytics.definition,
      exportAnalyticsData.definition,
      getAnalyticsOverview.definition,
    ],
  }
})

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case "track_skill_invoke":
        return await trackSkillInvoke.handler(args)
      case "track_user_feedback":
        return await trackUserFeedback.handler(args)
      case "query_analytics":
        return await queryAnalytics.handler(args)
      case "export_analytics_data":
        return await exportAnalyticsData.handler(args)
      case "get_analytics_overview":
        return await getAnalyticsOverview.handler(args)
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("Skills Hub Analytics MCP Server running on stdio")
}

main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
```

**Step 2: Build the MCP Server**

Run: `cd mcp-analytics-server && npm install && npm run build 2>&1 | tail -20`
Expected: Build completes with no errors, `dist/` directory created

**Step 3: Verify build output**

Run: `ls -la mcp-analytics-server/dist/`
Expected: `index.js`, `tools/`, `lib/` directories with compiled JS files

**Step 4: Commit**

```bash
git add mcp-analytics-server/src/index.ts mcp-analytics-server/dist/
git commit -m "feat(mcp): create MCP server entry point and build"
```

**🔍 检测点:** Build succeeds; dist/ contains compiled files
**✅ 验收标准:**
- Server registers all 5 tools
- Handles tool calls via switch statement
- Connects via StdioServerTransport
- Logs startup message to stderr

---

## Phase 5: Testing and Documentation

### Task 10: Create Test Configuration and Example Usage

**Files:**
- Create: `mcp-analytics-server/claude_desktop_config.json.example`
- Create: `mcp-analytics-server/USAGE_EXAMPLES.md`

**Step 1: Create claude_desktop_config.json.example**

```json
{
  "mcpServers": {
    "skills-hub-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-analytics-server/dist/index.js"],
      "env": {
        "ANALYTICS_ENDPOINT": "http://127.0.0.1:19823"
      }
    }
  }
}
```

**Step 2: Create USAGE_EXAMPLES.md**

```markdown
# MCP Server Usage Examples

## Prerequisites

1. Skills Hub app must be running (provides ingest server on 127.0.0.1:19823)
2. MCP Server must be configured in Claude Desktop

## Example 1: Track a Skill Invocation

**User Request:**
"Track this API call: skill_id=weather_query, session_id=abc123, success=true, duration=1.5s"

**Claude Action:**
Calls `track_skill_invoke` tool with:
```json
{
  "skill_id": "weather_query",
  "session_id": "abc123",
  "success": true,
  "duration_ms": 1500
}
```

**Result:**
```
✅ Successfully tracked skill invocation: weather_query (session: abc123, success: true, duration: 1500ms)
```

## Example 2: Track with Cost Information

**User Request:**
"Track this LLM call: skill_id=code_assistant, 500 input tokens, 300 output tokens, cost $0.005"

**Claude Action:**
Calls `track_skill_invoke` tool with:
```json
{
  "skill_id": "code_assistant",
  "session_id": "session_xyz",
  "success": true,
  "duration_ms": 2300,
  "cost": {
    "token_input": 500,
    "token_output": 300,
    "api_cost_usd": 0.005
  }
}
```

## Example 3: Record User Feedback

**User Request:**
"The user gave a thumbs up to the weather query"

**Claude Action:**
Calls `track_user_feedback` tool with:
```json
{
  "skill_id": "weather_query",
  "session_id": "abc123",
  "score": 1
}
```

**Result:**
```
✅ Recorded user feedback 👍 for skill: weather_query (session: abc123)
```

## Example 4: Get Analytics Overview

**User Request:**
"Show me analytics overview for the past 7 days"

**Claude Action:**
Calls `get_analytics_overview` tool with:
```json
{
  "days": 7
}
```

**Result:**
```
📊 Analytics Overview (Past 7 days)

**Key Metrics:**
- Total Calls: 1,234
- Active Users: 45
- Success Rate: 98.5%
- Avg Response Time: 856ms
- Total Cost: $0.0456

**Top Skills:**
- weather_query: 456 calls (99.1% success)
- code_assistant: 234 calls (97.4% success)
- data_analyzer: 189 calls (99.5% success)
```

## Example 5: Query Top Skills

**User Request:**
"What are the top 5 most used skills this month?"

**Claude Action:**
Calls `query_analytics` tool with:
```json
{
  "query_type": "top_skills",
  "days": 30,
  "limit": 5
}
```

## Example 6: Export Data to CSV

**User Request:**
"Export last month's analytics data to a CSV file"

**Claude Action:**
Calls `export_analytics_data` tool with:
```json
{
  "format": "csv",
  "date_range": {
    "start": "2026-01-01T00:00:00Z",
    "end": "2026-01-31T23:59:59Z"
  }
}
```

**Result:**
```
📊 Analytics data exported successfully!

**Format:** CSV
**File:** /path/to/analytics_export_1234567890.csv
**Size:** 12,345 bytes
```

## Example 7: Export to JSON

**User Request:**
"Export all analytics data to JSON format"

**Claude Action:**
Calls `export_analytics_data` tool with:
```json
{
  "format": "json",
  "output_path": "/Users/username/Documents/analytics_report.json"
}
```

## Example 8: Query Daily Trends

**User Request:**
"Show me the daily trend for the past 30 days"

**Claude Action:**
Calls `query_analytics` tool with:
```json
{
  "query_type": "daily_trend",
  "days": 30
}
```

## Example 9: Track Failed Invocation

**User Request:**
"The weather query failed with timeout error after 30 seconds"

**Claude Action:**
Calls `track_skill_invoke` tool with:
```json
{
  "skill_id": "weather_query",
  "session_id": "session_failed",
  "success": false,
  "duration_ms": 30000,
  "error": "Timeout: API did not respond within 30s"
}
```

## Example 10: Query Cost Summary

**User Request:**
"What's the cost breakdown by skill for this month?"

**Claude Action:**
Calls `query_analytics` tool with:
```json
{
  "query_type": "cost_summary",
  "days": 30
}
```
```

**Step 3: Commit**

```bash
git add mcp-analytics-server/claude_desktop_config.json.example mcp-analytics-server/USAGE_EXAMPLES.md
git commit -m "docs(mcp): add configuration example and usage documentation"
```

**🔍 检测点:** Files created with complete examples
**✅ 验收标准:**
- Config example shows correct path and env var
- 10 usage examples cover all tools
- Examples include user request, tool call, and result

---

## Phase 6: Integration with Skills Hub

### Task 11: Update Skills Hub README with MCP Instructions

**Files:**
- Modify: `README.md`

**Step 1: Add MCP Server section to README**

Insert before "## Development" section:

```markdown
## MCP Server Integration

Skills Hub provides an MCP (Model Context Protocol) Server that enables Claude AI to directly track skill invocations and query analytics data without writing code.

### Installation

1. Build the MCP Server:
```bash
cd mcp-analytics-server
npm install
npm run build
```

2. Configure Claude Desktop by adding to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "skills-hub-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-analytics-server/dist/index.js"],
      "env": {
        "ANALYTICS_ENDPOINT": "http://127.0.0.1:19823"
      }
    }
  }
}
```

3. Restart Claude Desktop and Skills Hub app

### Available Tools

- **track_skill_invoke**: Track skill executions with timing and cost
- **track_user_feedback**: Record 👍/👎 feedback
- **query_analytics**: Query various analytics dimensions
- **export_analytics_data**: Export data to JSON/CSV
- **get_analytics_overview**: Quick overview of key metrics

### Usage Examples

Ask Claude:
- "Track this API call: skill_id=weather, duration=1.5s, success=true"
- "Show me analytics overview for the past 7 days"
- "Export last month's data to CSV"
- "What are the top 5 most used skills?"

See `mcp-analytics-server/USAGE_EXAMPLES.md` for more examples.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add MCP server integration instructions to main README"
```

**🔍 检测点:** README updated with MCP section
**✅ 验收标准:**
- MCP section added before Development section
- Includes installation steps
- Lists all 5 available tools
- Provides usage examples

---

## Final Testing

### Task 12: End-to-End Testing

**Step 1: Start Skills Hub app**

Ensure Skills Hub app is running and ingest server is listening on 127.0.0.1:19823

**Step 2: Test MCP Server startup**

Run: `node mcp-analytics-server/dist/index.js < /dev/null`
Expected: Server starts without errors

**Step 3: Test each tool manually (via Claude Desktop)**

Configure Claude Desktop with MCP server and test:
1. `track_skill_invoke` - Track a sample invocation
2. `track_user_feedback` - Record feedback
3. `get_analytics_overview` - Get overview
4. `query_analytics` - Query different types
5. `export_analytics_data` - Export JSON and CSV

**Step 4: Verify data persistence**

Check SQLite database: `~/.skillshub/skills_hub_analytics.db`

**Step 5: Create integration test script**

Create: `scripts/test_mcp_integration.sh`

```bash
#!/bin/bash
set -e

echo "Testing MCP Server Integration..."

# Check if Skills Hub is running
if ! curl -s http://127.0.0.1:19823 > /dev/null; then
  echo "❌ Skills Hub not running. Please start the app first."
  exit 1
fi

echo "✅ Skills Hub is running"

# Check MCP Server build
if [ ! -f "mcp-analytics-server/dist/index.js" ]; then
  echo "❌ MCP Server not built. Run: cd mcp-analytics-server && npm run build"
  exit 1
fi

echo "✅ MCP Server is built"

# Test query endpoint
echo "Testing query endpoint..."
curl -s http://127.0.0.1:19823/v1/analytics/overview?days=7 | jq . > /dev/null

echo "✅ All integration tests passed!"
```

**Step 6: Make test script executable**

Run: `chmod +x scripts/test_mcp_integration.sh`

**Step 7: Run integration test**

Run: `./scripts/test_mcp_integration.sh`
Expected: All tests pass

**Step 8: Commit**

```bash
git add scripts/test_mcp_integration.sh
git commit -m "test(mcp): add integration test script"
```

**🔍 检测点:** Integration test passes
**✅ 验收标准:**
- Skills Hub running check passes
- MCP Server build check passes
- Query endpoint responds correctly
- All tools work via Claude Desktop

---

## Final Verification Checklist

| # | Check Item | Command |
|---|------------|---------|
| 1 | Backend query endpoints work | `curl http://127.0.0.1:19823/v1/analytics/overview` |
| 2 | MCP Server builds successfully | `cd mcp-analytics-server && npm run build` |
| 3 | All 5 tools registered | Check Claude Desktop tool list |
| 4 | track_skill_invoke works | Test via Claude Desktop |
| 5 | track_user_feedback works | Test via Claude Desktop |
| 6 | query_analytics works | Test via Claude Desktop |
| 7 | get_analytics_overview works | Test via Claude Desktop |
| 8 | export_analytics_data works | Test via Claude Desktop |
| 9 | Data persists to SQLite | Check skills_hub_analytics.db |
| 10 | Integration test passes | `./scripts/test_mcp_integration.sh` |
| 11 | Documentation complete | Check README and USAGE_EXAMPLES.md |
| 12 | No TypeScript errors | `cd mcp-analytics-server && npx tsc --noEmit` |

---

## Summary

This plan implements a complete MCP Server that enables Claude AI to:

1. **Track skill invocations** with full context (timing, success/failure, cost)
2. **Record user feedback** via simple 👍/👎 interface
3. **Query analytics data** across 7 different dimensions
4. **Export data** to JSON or CSV for further analysis
5. **Get quick overviews** of key metrics

The implementation:
- Reuses existing backend infrastructure (ingest server, SQLite)
- Follows MCP protocol standards
- Provides zero-code integration for users
- Includes comprehensive documentation and examples
- Maintains consistency with existing SDK approach

Total estimated implementation time: **2-3 hours** (12 tasks, each 10-15 minutes)
