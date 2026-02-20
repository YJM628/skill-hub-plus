import { FolderTree as FileTreeIcon, Edit, Columns, Eye, Languages, Zap } from 'lucide-react'
import { SUPPORTED_LANGUAGES } from '../../../services/translationService'
import type { Language } from '../../../services/translationService'

interface ViewModeSelectorProps {
  viewMode: 'edit' | 'split' | 'preview' | 'translate' | 'optimize'
  showFileTree: boolean
  targetLanguage: Language
  onToggleFileTree: () => void
  onViewModeChange: (mode: 'edit' | 'split' | 'preview' | 'translate' | 'optimize') => void
  onTargetLanguageChange: (lang: Language) => void
  onRetryTranslation: () => void
  translating: boolean
  t: (key: string) => string
}

export function ViewModeSelector({
  viewMode,
  showFileTree,
  targetLanguage,
  onToggleFileTree,
  onViewModeChange,
  onTargetLanguageChange,
  onRetryTranslation,
  translating,
  t
}: ViewModeSelectorProps) {
  return (
    <>
      <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
        <button
          onClick={onToggleFileTree}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            showFileTree
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title="Toggle File Tree"
        >
          <FileTreeIcon size={16} />
          <span className="text-sm">Files</span>
        </button>
        <div className="w-px h-6 bg-gray-700 mx-1" />
        <button
          onClick={() => onViewModeChange('edit')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            viewMode === 'edit'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={t('editMode')}
        >
          <Edit size={16} />
          <span className="text-sm">{t('edit')}</span>
        </button>
        <button
          onClick={() => onViewModeChange('split')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            viewMode === 'split'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={t('splitMode')}
        >
          <Columns size={16} />
          <span className="text-sm">{t('split')}</span>
        </button>
        <button
          onClick={() => onViewModeChange('preview')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            viewMode === 'preview'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={t('previewMode')}
        >
          <Eye size={16} />
          <span className="text-sm">{t('preview')}</span>
        </button>
        <button
          onClick={() => onViewModeChange('translate')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            viewMode === 'translate'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={t('translateMode')}
        >
          <Languages size={16} />
          <span className="text-sm">{t('translate')}</span>
        </button>
        <button
          onClick={() => onViewModeChange('optimize')}
          className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
            viewMode === 'optimize'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
          title={t('optimizeMode')}
        >
          <Zap size={16} />
          <span className="text-sm">{t('optimize')}</span>
        </button>
      </div>

      {/* Language Selector for Translate Mode */}
      {viewMode === 'translate' && (
        <>
          <div className="h-6 w-px bg-gray-700 mx-2" />
          <select
            value={targetLanguage}
            onChange={(e) => {
              onTargetLanguageChange(e.target.value as Language)
            }}
            className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName}
              </option>
            ))}
          </select>
          <button
            onClick={onRetryTranslation}
            disabled={translating}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={t('retryTranslation')}
          >
            <span className="text-sm">{t('retry')}</span>
          </button>
        </>
      )}
    </>
  )
}
