import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { GitBranch, ArrowRight, Zap, TrendingUp } from 'lucide-react'
import type { CallerDependency } from './types'

interface DependencyGraphProps {
  data: CallerDependency[]
  loading: boolean
}

interface SkillDependency {
  id: string
  name: string
  calls: number
  dependencies: string[]
  color: string
}

const DependencyGraph = ({ data, loading }: DependencyGraphProps) => {
  const navigate = useNavigate()

  // Process caller analysis data into dependency structure
  const processDependencies = (callerData: CallerDependency[]): SkillDependency[] => {
    const skillMap = new Map<string, SkillDependency>()
    const colorPalette = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-red-500',
      'from-indigo-500 to-purple-500',
      'from-teal-500 to-blue-500',
    ]

    // Group by caller_agent (skill_id) and build dependency structure
    callerData.forEach((dep, index) => {
      if (!skillMap.has(dep.caller_agent)) {
        skillMap.set(dep.caller_agent, {
          id: dep.caller_agent,
          name: dep.caller_agent,
          calls: 0,
          dependencies: [],
          color: colorPalette[index % colorPalette.length],
        })
      }

      const skill = skillMap.get(dep.caller_agent)!
      skill.calls += dep.call_count
      if (!skill.dependencies.includes(dep.skill_id)) {
        skill.dependencies.push(dep.skill_id)
      }
    })

    return Array.from(skillMap.values()).sort((a, b) => b.calls - a.calls)
  }

  const dependencies = processDependencies(data)

  const handleSkillClick = (skillId: string) => {
    navigate(`/skill/${encodeURIComponent(skillId)}`)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4" />
        <div className="h-64 bg-gray-100 dark:bg-gray-700 rounded animate-pulse" />
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <GitBranch className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-200">
              Skill Dependencies
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Visualization of skill call relationships
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <Zap className="w-4 h-4" />
          <span>{dependencies.length} skills</span>
        </div>
      </div>

      <div className="space-y-4">
        {dependencies.map((skill) => (
          <div key={skill.id} className="group">
            {/* Main Skill Card */}
            <button
              onClick={() => handleSkillClick(skill.id)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800/50 border border-gray-200 dark:border-gray-600 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 cursor-pointer">
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${skill.color} flex items-center justify-center shadow-lg`}>
                  <GitBranch className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-gray-800 dark:text-gray-200 truncate">
                      {skill.name}
                    </h4>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full">
                      {skill.calls} calls
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {skill.dependencies.length > 0
                      ? `Depends on ${skill.dependencies.length} skill${skill.dependencies.length > 1 ? 's' : ''}`
                      : 'No dependencies'}
                  </p>
                </div>
                <TrendingUp className="w-5 h-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>

            {/* Dependencies */}
            {skill.dependencies.length > 0 && (
              <div className="ml-8 mt-2 space-y-2">
                {skill.dependencies.map((depId) => {
                  const depSkill = dependencies.find((s) => s.id === depId)
                  if (!depSkill) return null

                  return (
                    <button
                      key={depId}
                      onClick={() => handleSkillClick(depId)}
                      className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer w-full text-left group/dep"
                    >
                      <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${depSkill.color} flex items-center justify-center shadow-sm`}>
                        <GitBranch className="w-4 h-4 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                          {depSkill.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {depSkill.calls} calls
                        </p>
                      </div>
                      <TrendingUp className="w-4 h-4 text-gray-400 opacity-0 group-hover/dep:opacity-100 transition-opacity flex-shrink-0" />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-blue-500 rounded-lg">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Dependency Insights
            </h5>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Skills with dependencies are automatically triggered when their parent skills are called.
              This helps maintain consistency and reduces manual coordination.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(DependencyGraph)