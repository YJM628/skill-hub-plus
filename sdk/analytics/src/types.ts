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
