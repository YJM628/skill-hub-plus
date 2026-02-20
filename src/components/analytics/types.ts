export interface OverviewStats {
  total_calls: number
  total_calls_delta_pct: number | null
  success_rate: number
  success_rate_delta: number | null
  p95_latency_ms: number | null
  p95_latency_delta_ms: number | null
  active_users: number
  active_users_delta: number | null
}

export interface DailyStats {
  skill_id: string
  date: string
  total_calls: number
  success_count: number
  fail_count: number
  avg_latency_ms: number
  p50_latency_ms?: number
  p95_latency_ms: number
  p99_latency_ms: number
  unique_users?: number
  total_cost_usd?: number
  thumbs_up?: number
  thumbs_down?: number
}

export interface TopSkillEntry {
  skill_id: string
  call_count: number
  success_rate: number
  avg_latency_ms: number
  p95_latency_ms?: number
  total_cost_usd?: number
  estimated_roi?: number
}

export interface AnalyticsAlert {
  id: string
  severity: 'critical' | 'warning' | 'info'
  message: string
  detected_at: number
  acknowledged: boolean
  skill_id?: string
}

export interface CallerDependency {
  caller_agent: string
  caller_tool: string
  skill_id: string
  call_count: number
}