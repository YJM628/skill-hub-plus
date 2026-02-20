import type { ITranslationProvider } from './ITranslationProvider'
import type { Language, TranslationError } from './types'

const GOOGLE_TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'

interface GoogleTranslateResponse {
  sentences: Array<{
    trans: string
    orig: string
  }>
}

export class GoogleTranslateProvider implements ITranslationProvider {
  private apiKey: string | null = null

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const url = new URL(GOOGLE_TRANSLATE_URL)
    url.searchParams.append('client', 'gtx')
    url.searchParams.append('sl', 'en')
    url.searchParams.append('tl', targetLang)
    url.searchParams.append('dt', 't')
    url.searchParams.append('q', text)
    
    if (this.apiKey) {
      url.searchParams.append('key', this.apiKey)
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      throw this.createError(
        `Google Translate HTTP error: ${response.status}`,
        'NETWORK_ERROR'
      )
    }

    const data: GoogleTranslateResponse = await response.json()
    
    if (data.sentences && data.sentences.length > 0) {
      return data.sentences.map((s) => s.trans).join('')
    }
    
    throw this.createError(
      'Google Translate returned empty response',
      'API_ERROR'
    )
  }

  setApiKey(key: string | null): void {
    this.apiKey = key
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  getProviderName(): string {
    return 'Google Translate'
  }

  private createError(
    message: string,
    code: 'RATE_LIMIT' | 'NETWORK_ERROR' | 'API_ERROR' | 'UNKNOWN'
  ): TranslationError {
    const error = new Error(message) as any
    error.name = 'TranslationError'
    error.code = code
    return error
  }
}
