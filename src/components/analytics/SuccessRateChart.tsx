import { memo } from 'react'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { DailyStats } from './types'

interface SuccessRateChartProps {
  data: DailyStats[]
  loading: boolean
}

const SuccessRateChart = ({ data, loading }: SuccessRateChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.map((day) => ({
    date: day.date,
    successRate: day.total_calls > 0 ? (day.success_count / day.total_calls) * 100 : 0,
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        📈 Success Rate Trend
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#9CA3AF" />
          <YAxis tick={{ fontSize: 12 }} stroke="#9CA3AF" domain={[0, 100]} />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F9FAFB',
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Success Rate']}
          />
          <Line
            type="monotone"
            dataKey="successRate"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 4, fill: '#10B981' }}
            activeDot={{ r: 6 }}
            name="Success Rate"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(SuccessRateChart)
