import { memo } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import type { DailyStats } from './types'

interface UserRetentionChartProps {
  data: DailyStats[]
  loading: boolean
}

const UserRetentionChart = ({ data, loading }: UserRetentionChartProps) => {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-48 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  const chartData = data.slice(-30).map((day, index) => ({
    date: day.date,
    activeUsers: day.unique_users ?? 0,
    newUsers: index === 0 ? day.unique_users ?? 0 : Math.max(0, (day.unique_users ?? 0) - (data[index - 1].unique_users ?? 0)),
  }))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        👥 User Activity
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
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
          <Legend />
          <Bar dataKey="activeUsers" fill="#3B82F6" name="Active Users" radius={[4, 4, 0, 0]} />
          <Bar dataKey="newUsers" fill="#10B981" name="New Users" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default memo(UserRetentionChart)
