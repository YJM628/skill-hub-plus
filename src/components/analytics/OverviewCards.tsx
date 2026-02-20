import { memo } from 'react'
import { Activity, CheckCircle, Clock, Users, TrendingUp, TrendingDown } from 'lucide-react'
import type { OverviewStats } from './types'

interface OverviewCardsProps {
  data: OverviewStats | null
  loading: boolean
}

interface StatCardProps {
  title: string
  value: string
  delta: string | null
  deltaPositive: boolean | null
  icon: React.ReactNode
  color: string
}

const StatCard = ({ title, value, delta, deltaPositive, icon, color }: StatCardProps) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between mb-3">
      <span className="text-sm font-medium text-gray-500 dark:text-gray-400">{title}</span>
      <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
    </div>
    <div className="text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
    {delta !== null && (
      <div className={`flex items-center gap-1 mt-2 text-sm ${
        deltaPositive ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'
      }`}>
        {deltaPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
        <span>{delta}</span>
      </div>
    )}
  </div>
)

const OverviewCards = ({ data, loading }: OverviewCardsProps) => {
  if (loading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-3" />
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  const formatNumber = (num: number): string => {
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
    if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`
    return num.toString()
  }

  const formatDelta = (value: number | null, suffix: string): string | null => {
    if (value === null) return null
    const sign = value >= 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}${suffix}`
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Calls"
        value={formatNumber(data.total_calls)}
        delta={formatDelta(data.total_calls_delta_pct, '%')}
        deltaPositive={data.total_calls_delta_pct !== null ? data.total_calls_delta_pct >= 0 : null}
        icon={<Activity size={18} className="text-blue-600" />}
        color="bg-blue-50 dark:bg-blue-900/30"
      />
      <StatCard
        title="Success Rate"
        value={`${(data.success_rate * 100).toFixed(1)}%`}
        delta={formatDelta(data.success_rate_delta !== null ? data.success_rate_delta * 100 : null, '%')}
        deltaPositive={data.success_rate_delta !== null ? data.success_rate_delta >= 0 : null}
        icon={<CheckCircle size={18} className="text-green-600" />}
        color="bg-green-50 dark:bg-green-900/30"
      />
      <StatCard
        title="P95 Latency"
        value={data.p95_latency_ms !== null ? `${data.p95_latency_ms}ms` : 'N/A'}
        delta={formatDelta(data.p95_latency_delta_ms, 'ms')}
        deltaPositive={data.p95_latency_delta_ms !== null ? data.p95_latency_delta_ms <= 0 : null}
        icon={<Clock size={18} className="text-orange-600" />}
        color="bg-orange-50 dark:bg-orange-900/30"
      />
      <StatCard
        title="Active Users"
        value={formatNumber(data.active_users)}
        delta={data.active_users_delta !== null ? `${data.active_users_delta >= 0 ? '+' : ''}${data.active_users_delta}` : null}
        deltaPositive={data.active_users_delta !== null ? data.active_users_delta >= 0 : null}
        icon={<Users size={18} className="text-purple-600" />}
        color="bg-purple-50 dark:bg-purple-900/30"
      />
    </div>
  )
}

export default memo(OverviewCards)
