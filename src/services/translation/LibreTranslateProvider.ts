import type { ITranslationProvider } from './ITranslationProvider'
import type { Language, TranslationError } from './types'

interface LibreTranslateResponse {
  translatedText: string
}

export class LibreTranslateProvider implements ITranslationProvider {
  private apiUrl: string
  private apiKey: string | null = null

  constructor(apiUrl: string = 'https://libretranslate.com/translate', apiKey?: string) {
    this.apiUrl = apiUrl
    this.apiKey = apiKey || null
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const url = this.apiUrl
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    
    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`
    }

    const body = {
      q: text,
      source: 'en',
      target: targetLang,
      format: 'text'
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    
    if (!response.ok) {
      if (response.status === 429) {
        throw this.createError(
          'LibreTranslate rate limit exceeded. Please wait a moment and try again.',
          'RATE_LIMIT'
        )
      }
      throw this.createError(
        `LibreTranslate HTTP error: ${response.status}`,
        'NETWORK_ERROR'
      )
    }

    const data: LibreTranslateResponse = await response.json()
    
    if (data.translatedText) {
      return data.translatedText
    }
    
    throw this.createError(
      'LibreTranslate returned empty response',
      'API_ERROR'
    )
  }

  setApiKey(key: string | null): void {
    this.apiKey = key
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  setApiUrl(url: string): void {
    this.apiUrl = url
  }

  getApiUrl(): string {
    return this.apiUrl
  }

  getProviderName(): string {
    return 'LibreTranslate'
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
