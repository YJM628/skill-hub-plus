import { memo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyStats } from './types'

interface DailyTrendChartProps {
  data: DailyStats[]
  loading: boolean
}

const DailyTrendChart = ({ data, loading }: DailyTrendChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-40 mb-4" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.map((day) => ({
    date: day.date.slice(5), // MM-DD
    calls: day.total_calls,
    success: day.success_count,
    fail: day.fail_count,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        📈 Daily Call Volume
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorFail" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
          />
          <Area
            type="monotone"
            dataKey="calls"
            stroke="#3B82F6"
            fill="url(#colorCalls)"
            strokeWidth={2}
            name="Total Calls"
          />
          <Area
            type="monotone"
            dataKey="fail"
            stroke="#EF4444"
            fill="url(#colorFail)"
            strokeWidth={1.5}
            name="Failures"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(DailyTrendChart)
