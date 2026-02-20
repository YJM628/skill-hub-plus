import { ArrowLeft, Save } from 'lucide-react'
import { ViewModeSelector } from './ViewModeSelector'

interface SkillDetailHeaderProps {
  skillName: string
  hasChanges: boolean
  saving: boolean
  viewMode: 'edit' | 'split' | 'preview' | 'translate' | 'optimize'
  showFileTree: boolean
  targetLanguage: string
  onBack: () => void
  onSave: () => void
  onToggleFileTree: () => void
  onViewModeChange: (mode: 'edit' | 'split' | 'preview' | 'translate' | 'optimize') => void
  onTargetLanguageChange: (lang: string) => void
  onRetryTranslation: () => void
  translating: boolean
  t: (key: string) => string
}

export function SkillDetailHeader({
  skillName,
  hasChanges,
  saving,
  viewMode,
  showFileTree,
  targetLanguage,
  onBack,
  onSave,
  onToggleFileTree,
  onViewModeChange,
  onTargetLanguageChange,
  onRetryTranslation,
  translating,
  t
}: SkillDetailHeaderProps) {
  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
          <span>{t('back')}</span>
        </button>
        <div className="h-6 w-px bg-gray-700" />
        <h1 className="text-xl font-semibold text-white">
          {skillName || t('skillDetail')}
        </h1>
        {hasChanges && (
          <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
            {t('unsaved')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ViewModeSelector
          viewMode={viewMode}
          showFileTree={showFileTree}
          targetLanguage={targetLanguage as any}
          onToggleFileTree={onToggleFileTree}
          onViewModeChange={onViewModeChange}
          onTargetLanguageChange={onTargetLanguageChange as any}
          onRetryTranslation={onRetryTranslation}
          translating={translating}
          t={t}
        />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges && !saving
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save size={18} />
          <span>{saving ? t('saving') : t('save')}</span>
        </button>
      </div>
    </div>
  )
}
