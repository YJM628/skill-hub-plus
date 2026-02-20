import { memo, useState } from 'react'
import { Copy, RefreshCw, Trash2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'
import type { TFunction } from 'i18next'
import type { ManagedSkill, ToolOption, CategoryInfoDto } from '../../shared/types'
import { invoke } from '@tauri-apps/api/core'

type GithubInfo = {
  label: string
  href: string
}

type SkillCardProps = {
  skill: ManagedSkill
  installedTools: ToolOption[]
  categories: CategoryInfoDto[]
  loading: boolean
  getGithubInfo: (url: string | null | undefined) => GithubInfo | null
  getSkillSourceLabel: (skill: ManagedSkill) => string
  formatRelative: (ms: number | null | undefined) => string
  onUpdate: (skill: ManagedSkill) => void
  onDelete: (skillId: string) => void
  onToggleTool: (skill: ManagedSkill, toolId: string) => void
  onCategoryChange?: (skillId: string, category: string | null) => void
  t: TFunction
}

const SkillCard = ({
  skill,
  installedTools,
  categories,
  loading,
  getGithubInfo,
  getSkillSourceLabel,
  formatRelative,
  onUpdate,
  onDelete,
  onToggleTool,
  onCategoryChange,
  t,
}: SkillCardProps) => {
  const navigate = useNavigate()
  const github = getGithubInfo(skill.source_ref)
  const copyValue = (github?.href ?? skill.source_ref ?? '').trim()
  const [isEditingCategory, setIsEditingCategory] = useState(false)
  const [newCategory, setNewCategory] = useState<string | null>(skill.category ?? null)

  const handleCategoryChange = async (category: string | null) => {
    try {
      await invoke('update_skill_category', { 
        skillId: skill.id, 
        category 
      })
      toast.success(t('categoryUpdated'))
      setNewCategory(category)
      setIsEditingCategory(false)
      onCategoryChange?.(skill.id, category)
    } catch (error) {
      toast.error(t('categoryUpdateFailed'))
      console.error('Failed to update category:', error)
    }
  }

  const handleCopy = async () => {
    if (!copyValue) return
    try {
      await navigator.clipboard.writeText(copyValue)
      toast.success(t('copied'))
    } catch {
      toast.error(t('copyFailed'))
    }
  }

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on interactive elements
    const target = e.target as HTMLElement
    if (
      target.closest('button') ||
      target.closest('select') ||
      target.closest('input') ||
      target.closest('.tool-pill')
    ) {
      return
    }
    navigate(`/skill/${skill.id}`)
  }

  return (
    <div className="skill-card" onClick={handleCardClick} style={{ cursor: 'pointer' }}>
      <div className="skill-main">
        <div className="skill-header-row">
          <div className="skill-name">{skill.name}</div>
        </div>
        {skill.description && (
          <div className="skill-description">{skill.description}</div>
        )}
        <div className="skill-meta-row">
          {github ? (
            <div className="skill-source">
              <button
                className="repo-pill copyable"
                type="button"
                title={t('copy')}
                aria-label={t('copy')}
                onClick={() => void handleCopy()}
                disabled={!copyValue}
              >
                {github.label}
                <span className="copy-icon" aria-hidden="true">
                  <Copy size={12} />
                </span>
              </button>
            </div>
          ) : (
            <div className="skill-source">
              <button
                className="repo-pill copyable"
                type="button"
                title={t('copy')}
                aria-label={t('copy')}
                onClick={() => void handleCopy()}
                disabled={!copyValue}
              >
                <span className="mono">{getSkillSourceLabel(skill)}</span>
                <span className="copy-icon" aria-hidden="true">
                  <Copy size={12} />
                </span>
              </button>
            </div>
          )}
          <div className="skill-source time">
            <span className="dot">•</span>
            {formatRelative(Number(skill.updated_at))}
          </div>
        </div>
        
        <div className="skill-category-section">
          {isEditingCategory ? (
            <div className="category-edit-mode">
              <div className="category-edit-header">
                <Tag size={14} className="category-icon" />
                <span className="category-edit-label">{t('categoryLabel')}</span>
              </div>
              <div className="category-edit-controls">
                <select
                  value={newCategory || 'none'}
                  onChange={(e) => setNewCategory(e.target.value === 'none' ? null : e.target.value)}
                  className="category-select-input"
                  disabled={loading}
                >
                  <option value="none">{t('categoryNone')}</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <div className="category-edit-actions">
                  <button
                    className="category-action-btn save"
                    type="button"
                    onClick={() => handleCategoryChange(newCategory)}
                    disabled={loading}
                    title={t('save')}
                  >
                    {t('save')}
                  </button>
                  <button
                    className="category-action-btn cancel"
                    type="button"
                    onClick={() => {
                      setIsEditingCategory(false)
                      setNewCategory(skill.category ?? null)
                    }}
                    disabled={loading}
                    title={t('cancel')}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="category-display-mode">
              <div className="category-info">
                <Tag size={13} className="category-icon-small" />
                <span className="category-label-text">{t('categoryLabel')}:</span>
                <span className={`category-badge category-${skill.category || 'none'}`}>
                  {(() => {
                    const category = categories.find((c) => c.id === skill.category)
                    return category ? category.name : t('categoryNone')
                  })()}
                </span>
              </div>
              <button
                className="category-edit-btn"
                type="button"
                onClick={() => setIsEditingCategory(true)}
                disabled={loading}
                aria-label={t('editCategory')}
                title={t('edit')}
              >
                {t('edit')}
              </button>
            </div>
          )}
        </div>
        <div className="tool-matrix">
          {installedTools.map((tool) => {
            const target = skill.targets.find((t) => t.tool === tool.id)
            const synced = Boolean(target)
            const state = synced ? 'active' : 'inactive'
            return (
              <button
                key={`${skill.id}-${tool.id}`}
                type="button"
                className={`tool-pill ${state}`}
                title={
                  synced
                    ? `${tool.label} (${target?.mode ?? t('unknown')})`
                    : tool.label
                }
                onClick={() => void onToggleTool(skill, tool.id)}
              >
                {synced ? <span className="status-badge" /> : null}
                {tool.label}
              </button>
            )
          })}
        </div>
      </div>
      <div className="skill-actions-col">
        <button
          className="card-btn primary-action"
          type="button"
          onClick={() => onUpdate(skill)}
          disabled={loading}
          aria-label={t('update')}
        >
          <RefreshCw size={16} />
        </button>
        <button
          className="card-btn danger-action"
          type="button"
          onClick={() => onDelete(skill.id)}
          disabled={loading}
          aria-label={t('remove')}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}

export default memo(SkillCard)