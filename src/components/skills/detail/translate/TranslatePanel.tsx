import { Loader2 } from 'lucide-react'
import { MarkdownPreview } from '../preview/MarkdownPreview'

interface TranslatePanelProps {
  content: string
  translatedContent: string
  translating: boolean
  translationError: string | null
  isRateLimitError: boolean
  onRetry: () => void
  onGoToSettings: () => void
  t: (key: string) => string
}

export function TranslatePanel({
  content,
  translatedContent,
  translating,
  translationError,
  isRateLimitError,
  onRetry,
  onGoToSettings,
  t
}: TranslatePanelProps) {
  return (
    <>
      {/* Original Content */}
      <div className="w-1/2 border-r border-gray-800 overflow-auto bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium">{t('original')}</span>
          </div>
        </div>
        <MarkdownPreview content={content} />
      </div>

      {/* Translated Content */}
      <div className="w-1/2 overflow-auto bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium">{t('translated')}</span>
            {translating && (
              <Loader2 size={14} className="animate-spin" />
            )}
          </div>
        </div>
        {translating ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin" />
              <span>{t('translating')}</span>
            </div>
          </div>
        ) : translationError ? (
          <div className="flex items-center justify-center h-full p-8">
            <div className="text-center max-w-md">
              <div className="text-red-400 mb-3">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-gray-300 mb-2">{translationError}</p>
              {isRateLimitError && (
                <p className="text-gray-400 text-sm mb-4">{t('errors.configureApiKeyHint')}</p>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={onRetry}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  {t('retry')}
                </button>
                {isRateLimitError && (
                  <button
                    onClick={onGoToSettings}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    {t('errors.goToSettings')}
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <MarkdownPreview content={translatedContent || t('noTranslation')} />
        )}
      </div>
    </>
  )
}
