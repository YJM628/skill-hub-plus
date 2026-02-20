import type { Language } from './types'

export interface ITranslationProvider {
  /**
   * Translate text to the target language
   */
  translate(text: string, targetLang: Language): Promise<string>
  
  /**
   * Set API key for the translation service
   */
  setApiKey(key: string | null): void
  
  /**
   * Get the current API key
   */
  getApiKey(): string | null
  
  /**
   * Get the name of the provider
   */
  getProviderName(): string
}
