import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { TopSkillEntry } from './types'

interface CostRoiTableProps {
  data: TopSkillEntry[]
  loading: boolean
}

const CostRoiTable = ({ data, loading }: CostRoiTableProps) => {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-12 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const handleSkillClick = (skillId: string) => {
    navigate(`/skill/${encodeURIComponent(skillId)}`)
  }

  const getRoiLabel = (successRate: number): { label: string; color: string } => {
    if (successRate >= 0.95) {
      return { label: 'High', color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' }
    }
    if (successRate >= 0.8) {
      return { label: 'Medium', color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300' }
    }
    return { label: 'Low', color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300' }
  }

  const calculateCost = (calls: number): number => {
    return calls * 0.001
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        💰 Cost & ROI Analysis
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Skill</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Calls</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Cost</th>
              <th className="text-right py-3 px-2 font-medium text-gray-600 dark:text-gray-400">Success</th>
              <th className="text-center py-3 px-2 font-medium text-gray-600 dark:text-gray-400">ROI</th>
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-400">
                  No cost data available
                </td>
              </tr>
            ) : (
              data.map((skill) => {
                const roi = getRoiLabel(skill.success_rate)
                const cost = calculateCost(skill.call_count)

                return (
                  <tr
                    key={skill.skill_id}
                    onClick={() => handleSkillClick(skill.skill_id)}
                    className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer group"
                  >
                    <td className="py-3 px-2 font-medium text-gray-800 dark:text-gray-200">
                      <div className="flex items-center gap-2">
                        <span>{skill.skill_id}</span>
                        <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </td>
                    <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">
                      {skill.call_count.toLocaleString()}
                    </td>
                    <td className="py-3 px-2 text-right text-gray-600 dark:text-gray-400">
                      ${cost.toFixed(2)}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <span className={skill.success_rate >= 0.95 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
                        {(skill.success_rate * 100).toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${roi.color}`}>
                        {roi.label}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default memo(CostRoiTable)
