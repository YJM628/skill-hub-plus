export type Language = 'zh' | 'ja' | 'ko' | 'es' | 'fr' | 'de' | 'ru' | 'pt' | 'it'
export type TranslationServiceType = 'mymemory' | 'google' | 'libretranslate'

export interface LanguageOption {
  code: Language
  name: string
  nativeName: string
}

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'zh', name: 'Chinese', nativeName: '中文' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語' },
  { code: 'ko', name: 'Korean', nativeName: '한국어' },
  { code: 'es', name: 'Spanish', nativeName: 'Español' },
  { code: 'fr', name: 'French', nativeName: 'Français' },
  { code: 'de', name: 'German', nativeName: 'Deutsch' },
  { code: 'ru', name: 'Russian', nativeName: 'Русский' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
  { code: 'it', name: 'Italian', nativeName: 'Italiano' },
]

export class TranslationError extends Error {
  readonly code: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN'
  
  constructor(
    message: string,
    code: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN'
  ) {
    super(message)
    this.name = 'TranslationError'
    this.code = code
  }
}