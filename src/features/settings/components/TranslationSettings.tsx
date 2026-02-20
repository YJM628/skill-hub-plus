import { memo } from 'react'
import { useTranslation } from 'react-i18next'

interface TranslationSettingsProps {
  translationServiceType: 'mymemory' | 'google' | 'libretranslate'
  translationApiKey: string
  googleTranslationApiKey: string
  libreTranslateApiKey: string
  libreTranslateApiUrl: string
  onTranslationServiceTypeChange: (type: 'mymemory' | 'google' | 'libretranslate') => void
  onTranslationApiKeyChange: (key: string) => void
  onGoogleTranslationApiKeyChange: (key: string) => void
  onLibreTranslateApiKeyChange: (key: string) => void
  onLibreTranslateApiUrlChange: (url: string) => void
}

const TranslationSettings = memo<TranslationSettingsProps>(({
  translationServiceType,
  translationApiKey,
  googleTranslationApiKey,
  libreTranslateApiKey,
  libreTranslateApiUrl,
  onTranslationServiceTypeChange,
  onTranslationApiKeyChange,
  onGoogleTranslationApiKeyChange,
  onLibreTranslateApiKeyChange,
  onLibreTranslateApiUrlChange,
}) => {
  const { t } = useTranslation()

  return (
    <>
      <div className="settings-field">
        <label className="settings-label" id="settings-translation-service-label">
          {t('translationService')}
        </label>
        <div className="settings-theme-options" role="group" aria-labelledby="settings-translation-service-label">
          <button
            type="button"
            className={`settings-theme-btn ${
              translationServiceType === 'mymemory' ? 'active' : ''
            }`}
            aria-pressed={translationServiceType === 'mymemory'}
            onClick={() => onTranslationServiceTypeChange('mymemory')}
          >
            {t('translationServiceOptions.mymemory')}
          </button>
          <button
            type="button"
            className={`settings-theme-btn ${
              translationServiceType === 'google' ? 'active' : ''
            }`}
            aria-pressed={translationServiceType === 'google'}
            onClick={() => onTranslationServiceTypeChange('google')}
          >
            {t('translationServiceOptions.google')}
          </button>
          <button
            type="button"
            className={`settings-theme-btn ${
              translationServiceType === 'libretranslate' ? 'active' : ''
            }`}
            aria-pressed={translationServiceType === 'libretranslate'}
            onClick={() => onTranslationServiceTypeChange('libretranslate')}
          >
            {t('translationServiceOptions.libretranslate')}
          </button>
        </div>
        <div className="settings-helper">{t('translationServiceHint')}</div>
      </div>

      {translationServiceType === 'mymemory' && (
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-translation-api-key">
            {t('myMemoryApiKey')}
          </label>
          <input
            id="settings-translation-api-key"
            className="settings-input mono"
            type="password"
            value={translationApiKey}
            onChange={(e) => onTranslationApiKeyChange(e.target.value)}
            placeholder={t('translationApiKeyPlaceholder')}
          />
          <div className="settings-helper">{t('translationApiKeyHint')}</div>
        </div>
      )}

      {translationServiceType === 'google' && (
        <div className="settings-field">
          <label className="settings-label" htmlFor="settings-google-translation-api-key">
            {t('googleTranslationApiKey')}
          </label>
          <input
            id="settings-google-translation-api-key"
            className="settings-input mono"
            type="password"
            value={googleTranslationApiKey}
            onChange={(e) => onGoogleTranslationApiKeyChange(e.target.value)}
            placeholder={t('googleTranslationApiKeyPlaceholder')}
          />
          <div className="settings-helper">{t('googleTranslationApiKeyHint')}</div>
        </div>
      )}

      {translationServiceType === 'libretranslate' && (
        <>
          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-libre-translate-api-url">
              {t('libreTranslateApiUrl')}
            </label>
            <input
              id="settings-libre-translate-api-url"
              className="settings-input mono"
              type="text"
              value={libreTranslateApiUrl}
              onChange={(e) => onLibreTranslateApiUrlChange(e.target.value)}
              placeholder={t('libreTranslateApiUrlPlaceholder')}
            />
            <div className="settings-helper">{t('libreTranslateApiUrlHint')}</div>
          </div>
          <div className="settings-field">
            <label className="settings-label" htmlFor="settings-libre-translate-api-key">
              {t('libreTranslateApiKey')}
            </label>
            <input
              id="settings-libre-translate-api-key"
              className="settings-input mono"
              type="password"
              value={libreTranslateApiKey}
              onChange={(e) => onLibreTranslateApiKeyChange(e.target.value)}
              placeholder={t('libreTranslateApiKeyPlaceholder')}
            />
            <div className="settings-helper">{t('libreTranslateApiKeyHint')}</div>
          </div>
        </>
      )}
    </>
  )
})

TranslationSettings.displayName = 'TranslationSettings'

export default TranslationSettings