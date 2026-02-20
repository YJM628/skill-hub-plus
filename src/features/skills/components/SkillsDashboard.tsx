import { memo } from 'react'
import type { TFunction } from 'i18next'
import type { ManagedSkill, CategoryInfoDto, ToolOption, OnboardingPlan } from '../../../shared/types'
import FilterBar from '../../../components/skills/FilterBar'
import SkillsList from '../../../components/skills/SkillsList'

interface SkillsDashboardProps {
  loading: boolean
  searchQuery: string
  sortBy: 'updated' | 'name'
  categoryFilter: string | null
  categories: CategoryInfoDto[]
  visibleSkills: ManagedSkill[]
  installedTools: ToolOption[]
  plan: OnboardingPlan | null
  getGithubInfo: (url: string | null | undefined) => { label: string; href: string } | null
  getSkillSourceLabel: (skill: ManagedSkill) => string
  formatRelative: (ms: number | null | undefined) => string
  onSortChange: (value: 'updated' | 'name') => void
  onSearchChange: (value: string) => void
  onCategoryFilterChange: (value: string | null) => void
  onRefresh: () => void
  onUpdateAll: () => void
  onReviewImport: () => void
  onUpdateSkill: (skill: ManagedSkill) => void
  onDeleteSkill: (skillId: string) => void
  onToggleTool: (skill: ManagedSkill, toolId: string) => void
  onSkillCategoryChange: (skillId: string, category: string | null) => void
  t: TFunction
}

const SkillsDashboard = memo(({
  loading,
  searchQuery,
  sortBy,
  categoryFilter,
  categories,
  visibleSkills,
  installedTools,
  plan,
  getGithubInfo,
  getSkillSourceLabel,
  formatRelative,
  onSortChange,
  onSearchChange,
  onCategoryFilterChange,
  onRefresh,
  onUpdateAll,
  onReviewImport,
  onUpdateSkill,
  onDeleteSkill,
  onToggleTool,
  onSkillCategoryChange,
  t,
}: SkillsDashboardProps) => {
  return (
    <div className="skills-main">
      <div className="dashboard-stack">
        <FilterBar
          sortBy={sortBy}
          searchQuery={searchQuery}
          categoryFilter={categoryFilter}
          categories={categories}
          loading={loading}
          onSortChange={onSortChange}
          onSearchChange={onSearchChange}
          onCategoryChange={onCategoryFilterChange}
          onRefresh={onRefresh}
          onUpdateAll={onUpdateAll}
          t={t}
        />
        <SkillsList
          plan={plan}
          visibleSkills={visibleSkills}
          installedTools={installedTools}
          categories={categories}
          loading={loading}
          getGithubInfo={getGithubInfo}
          getSkillSourceLabel={getSkillSourceLabel}
          formatRelative={formatRelative}
          onReviewImport={onReviewImport}
          onUpdateSkill={onUpdateSkill}
          onDeleteSkill={onDeleteSkill}
          onToggleTool={onToggleTool}
          onCategoryChange={onSkillCategoryChange}
          t={t}
        />
      </div>
    </div>
  )
})

SkillsDashboard.displayName = 'SkillsDashboard'

export default SkillsDashboard