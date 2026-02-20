import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import type { TopSkillEntry } from './types'

interface TopSkillsRankingProps {
  data: TopSkillEntry[]
  loading: boolean
}

const TopSkillsRanking = ({ data, loading }: TopSkillsRankingProps) => {
  const navigate = useNavigate()

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="h-8 bg-gray-100 dark:bg-gray-700 rounded mb-2 animate-pulse" />
        ))}
      </div>
    )
  }

  const maxCalls = data.length > 0 ? data[0].call_count : 1

  const handleSkillClick = (skillId: string) => {
    navigate(`/skill/${encodeURIComponent(skillId)}`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        🏆 Top 10 Skills
      </h3>
      <div className="space-y-3">
        {data.map((skill, index) => {
          const barWidth = (skill.call_count / maxCalls) * 100
          const successColor = skill.success_rate >= 0.95
            ? 'text-green-600 dark:text-green-400'
            : skill.success_rate >= 0.8
              ? 'text-yellow-600 dark:text-yellow-400'
              : 'text-red-600 dark:text-red-400'

          return (
            <button
              key={skill.skill_id}
              onClick={() => handleSkillClick(skill.skill_id)}
              className="flex items-center gap-3 w-full text-left hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg p-2 -mx-2 transition-colors cursor-pointer group"
            >
              <span className="text-sm font-mono text-gray-400 w-5 text-right flex-shrink-0">
                {index + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                      {skill.skill_id}
                    </span>
                    <ExternalLink className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </div>
                  <div className="flex items-center gap-3 text-xs flex-shrink-0 ml-2">
                    <span className="text-gray-500">{skill.call_count} calls</span>
                    <span className={successColor}>
                      {(skill.success_rate * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
            </button>
          )
        })}
        {data.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">No data yet</p>
        )}
      </div>
    </div>
  )
}

export default memo(TopSkillsRanking)
