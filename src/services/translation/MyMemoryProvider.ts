import type { ITranslationProvider } from './ITranslationProvider'
import type { Language, TranslationError } from './types'

const MYMEMORY_API_URL = 'https://api.mymemory.translated.net/get'

interface MyMemoryResponse {
  responseData: {
    translatedText: string
    match: number
  }
  responseStatus: number
  responseDetails: string
}

export class MyMemoryProvider implements ITranslationProvider {
  private apiKey: string | null = null

  constructor(apiKey?: string) {
    this.apiKey = apiKey || null
  }

  async translate(text: string, targetLang: Language): Promise<string> {
    const url = new URL(MYMEMORY_API_URL)
    url.searchParams.append('q', text)
    url.searchParams.append('langpair', `en|${targetLang}`)
    
    if (this.apiKey) {
      url.searchParams.append('key', this.apiKey)
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    })
    
    if (!response.ok) {
      if (response.status === 429) {
        throw this.createError(
          'Translation API rate limit exceeded. Please wait a moment and try again.',
          'RATE_LIMIT'
        )
      }
      throw this.createError(
        `HTTP error: ${response.status}`,
        'NETWORK_ERROR'
      )
    }

    const data: MyMemoryResponse = await response.json()

    if (data.responseStatus === 200) {
      return data.responseData.translatedText
    } else if (data.responseStatus === 429) {
      throw this.createError(
        'Translation API rate limit exceeded. Please wait a moment and try again.',
        'RATE_LIMIT'
      )
    } else if (data.responseStatus === 403) {
      throw this.createError(
        'API access forbidden. The service may be temporarily unavailable.',
        'API_ERROR'
      )
    } else if (data.responseStatus === 503) {
      throw this.createError(
        'Translation service temporarily unavailable. Please try again later.',
        'API_ERROR'
      )
    } else {
      throw this.createError(
        `Translation failed: ${data.responseDetails || 'Unknown error'}`,
        'API_ERROR'
      )
    }
  }

  setApiKey(key: string | null): void {
    this.apiKey = key
  }

  getApiKey(): string | null {
    return this.apiKey
  }

  getProviderName(): string {
    return 'MyMemory'
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
