import { memo, useState, useMemo } from 'react'
import { MessageCircle, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { ManagedSkill, OnboardingPlan, ToolOption, CategoryInfoDto } from './types'
import SkillCard from './SkillCard'

type GithubInfo = {
  label: string
  href: string
}

type SkillsListProps = {
  plan: OnboardingPlan | null
  visibleSkills: ManagedSkill[]
  installedTools: ToolOption[]
  categories: CategoryInfoDto[]
  loading: boolean
  getGithubInfo: (url: string | null | undefined) => GithubInfo | null
  getSkillSourceLabel: (skill: ManagedSkill) => string
  formatRelative: (ms: number | null | undefined) => string
  onReviewImport: () => void
  onUpdateSkill: (skill: ManagedSkill) => void
  onDeleteSkill: (skillId: string) => void
  onToggleTool: (skill: ManagedSkill, toolId: string) => void
  onCategoryChange?: (skillId: string, category: string | null) => void
  t: TFunction
}

const PAGE_SIZE_OPTIONS = [10, 20, 50]

const SkillsList = ({
  plan,
  visibleSkills,
  installedTools,
  categories,
  loading,
  getGithubInfo,
  getSkillSourceLabel,
  formatRelative,
  onReviewImport,
  onUpdateSkill,
  onDeleteSkill,
  onToggleTool,
  onCategoryChange,
  t,
}: SkillsListProps) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const totalPages = Math.ceil(visibleSkills.length / pageSize)

  const paginatedSkills = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return visibleSkills.slice(startIndex, endIndex)
  }, [visibleSkills, currentPage, pageSize])

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages))
  }

  const handlePageChange = (page: number) => {
    setCurrentPage(page)
  }

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize)
  }

  return (
    <div className="skills-list">
      {plan && plan.total_skills_found > 0 ? (
        <div className="discovered-banner">
          <div className="banner-left">
            <div className="banner-icon">
              <MessageCircle size={18} />
            </div>
            <div className="banner-content">
              <div className="banner-title">{t('discoveredTitle')}</div>
              <div className="banner-subtitle">
                {t('discoveredCount', { count: plan.total_skills_found })}
              </div>
            </div>
          </div>
          <button
            className="btn btn-warning"
            type="button"
            onClick={onReviewImport}
            disabled={loading}
          >
            {t('reviewImport')}
          </button>
        </div>
      ) : null}

      {visibleSkills.length === 0 ? (
        <div className="empty">{t('skillsEmpty')}</div>
      ) : (
        <>
          {paginatedSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installedTools={installedTools}
              categories={categories}
              loading={loading}
              getGithubInfo={getGithubInfo}
              getSkillSourceLabel={getSkillSourceLabel}
              formatRelative={formatRelative}
              onUpdate={onUpdateSkill}
              onDelete={onDeleteSkill}
              onToggleTool={onToggleTool}
              onCategoryChange={onCategoryChange}
              t={t}
            />
          ))}

          {visibleSkills.length > 0 && (
            <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2">
                <button
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={handlePreviousPage}
                  disabled={currentPage === 1}
                  aria-label="上一页"
                >
                  <ChevronLeft size={16} />
                  <span>上一页</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      className={`min-w-[32px] h-8 px-2 text-sm rounded transition-colors ${
                        currentPage === page
                          ? 'bg-blue-500 text-white font-medium'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                      onClick={() => handlePageChange(page)}
                      aria-label={`第 ${page} 页`}
                      aria-current={currentPage === page ? 'page' : undefined}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  aria-label="下一页"
                >
                  <span>下一页</span>
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">每页显示:</span>
                <div className="relative">
                  <select
                    value={pageSize}
                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                    className="appearance-none pl-3 pr-8 py-1.5 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                    aria-label="选择每页显示数量"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500 dark:text-gray-400"
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default memo(SkillsList)