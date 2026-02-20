import { memo } from 'react'
import { ArrowUpDown, RefreshCw, Search } from 'lucide-react'
import type { TFunction } from 'i18next'
import type { CategoryInfoDto } from './types'

type FilterBarProps = {
  sortBy: 'updated' | 'name'
  searchQuery: string
  categoryFilter: string | null
  categories: CategoryInfoDto[]
  loading: boolean
  onSortChange: (value: 'updated' | 'name') => void
  onSearchChange: (value: string) => void
  onCategoryChange: (value: string | null) => void
  onRefresh: () => void
  onUpdateAll: () => void
  t: TFunction
}

const FilterBar = ({
  sortBy,
  searchQuery,
  categoryFilter,
  categories,
  loading,
  onSortChange,
  onSearchChange,
  onCategoryChange,
  onRefresh,
  onUpdateAll,
  t,
}: FilterBarProps) => {
  return (
    <div className="filter-bar">
      <div className="filter-title">{t('allSkills')}</div>
      <div className="filter-actions">
        <button className="btn btn-secondary sort-btn" type="button">
          <span className="sort-label">{t('filterCategory')}:</span>
          {categoryFilter ? t(`categories.${categoryFilter}`) : t('categoryAll')}
          <ArrowUpDown size={12} />
          <select
            aria-label={t('filterCategory')}
            value={categoryFilter || 'all'}
            onChange={(event) => {
              const value = event.target.value
              onCategoryChange(value === 'all' ? null : value)
            }}
          >
            <option value="all">{t('categoryAll')}</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </button>
        <button className="btn btn-secondary sort-btn" type="button">
          <span className="sort-label">{t('filterSort')}:</span>
          {sortBy === 'updated' ? t('sortUpdated') : t('sortName')}
          <ArrowUpDown size={12} />
          <select
            aria-label={t('filterSort')}
            value={sortBy}
            onChange={(event) => onSortChange(event.target.value as 'updated' | 'name')}
          >
            <option value="updated">{t('sortUpdated')}</option>
            <option value="name">{t('sortName')}</option>
          </select>
        </button>
        <div className="search-container">
          <Search size={16} className="search-icon-abs" />
          <input
            className="search-input"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onUpdateAll}
          disabled={loading}
        >
          <RefreshCw size={14} />
          {t('updateAll')}
        </button>
        <button
          className="btn btn-secondary"
          type="button"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCw size={14} />
          {t('refresh')}
        </button>
      </div>
    </div>
  )
}

export default memo(FilterBar)
