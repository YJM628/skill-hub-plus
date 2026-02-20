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
