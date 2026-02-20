import type { Language, TranslationServiceType, LanguageOption } from './translation/types'
import { SUPPORTED_LANGUAGES, TranslationError } from './translation/types'
import { TranslationCache } from './translation/cache'
import type { ITranslationProvider } from './translation/ITranslationProvider'
import { MyMemoryProvider } from './translation/MyMemoryProvider'
import { GoogleTranslateProvider } from './translation/GoogleTranslateProvider'
import { LibreTranslateProvider } from './translation/LibreTranslateProvider'


export type { Language, TranslationServiceType, LanguageOption }
export { SUPPORTED_LANGUAGES, TranslationError }

export class TranslationService {
  private static instance: TranslationService
  private cache: TranslationCache
  private requestDelay = 2000
  private lastRequestTime = 0
  private serviceType: TranslationServiceType = 'mymemory'
  private providers: Map<TranslationServiceType, ITranslationProvider>

  private constructor() {
    this.cache = new TranslationCache()
    this.providers = new Map()
    this.loadCacheFromStorage()
    this.initializeProviders()
    this.loadServiceType()
  }

  private initializeProviders(): void {
    const myMemoryApiKey = this.loadApiKey('mymemory')
    const googleApiKey = this.loadApiKey('google')
    const libreTranslateApiKey = this.loadApiKey('libretranslate')
    const libreTranslateUrl = this.loadApiUrl('libretranslate')
    
    this.providers.set('mymemory', new MyMemoryProvider(myMemoryApiKey))
    this.providers.set('google', new GoogleTranslateProvider(googleApiKey))
    this.providers.set('libretranslate', new LibreTranslateProvider(libreTranslateUrl || 'https://libretranslate.com/translate', libreTranslateApiKey))

  }

  static getInstance(): TranslationService {
    if (!TranslationService.instance) {
      TranslationService.instance = new TranslationService()
    }
    return TranslationService.instance
  }

  private loadCacheFromStorage(): void {
    try {
      const saved = localStorage.getItem('translationCache')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.entries && Array.isArray(data.entries)) {
          data.entries.forEach(([key, value]: [string, string]) => {
            this.cache.setRaw(key, value)
          })
        }
      }
    } catch (error) {
      console.warn('Failed to load translation cache:', error)
    }
  }

  private saveCacheToStorage(): void {
    try {
      const entries = this.cache.getAllEntries()
      localStorage.setItem('translationCache', JSON.stringify({ entries }))
    } catch (error) {
      console.warn('Failed to save translation cache:', error)
    }
  }

  private loadApiKey(serviceType: 'mymemory' | 'google' | 'libretranslate'): string | null {
    try {
      const key = localStorage.getItem(`${serviceType}TranslationApiKey`)
      return key || null
    } catch (error) {
      console.warn(`Failed to load ${serviceType} translation API key:`, error)
      return null
    }
  }

  private loadApiUrl(serviceType: 'libretranslate'): string | null {
    try {
      const url = localStorage.getItem(`${serviceType}ApiUrl`)
      return url || null
    } catch (error) {
      console.warn(`Failed to load ${serviceType} API URL:`, error)
      return null
    }
  }

  private saveApiKey(serviceType: 'mymemory' | 'google' | 'libretranslate', key: string | null): void {
    try {
      if (key) {
        localStorage.setItem(`${serviceType}TranslationApiKey`, key)
      } else {
        localStorage.removeItem(`${serviceType}TranslationApiKey`)
      }
    } catch (error) {
      console.warn(`Failed to save ${serviceType} translation API key:`, error)
    }
  }

  setApiKey(key: string | null): void {
    this.saveApiKey('mymemory', key)
    const provider = this.providers.get('mymemory')
    if (provider) {
      provider.setApiKey(key)
    }
  }

  getApiKey(): string | null {
    const provider = this.providers.get('mymemory')
    return provider ? provider.getApiKey() : null
  }

  setGoogleApiKey(key: string | null): void {
    this.saveApiKey('google', key)
    const provider = this.providers.get('google')
    if (provider) {
      provider.setApiKey(key)
    }
  }

  getGoogleApiKey(): string | null {
    const provider = this.providers.get('google')
    return provider ? provider.getApiKey() : null
  }

  private saveApiUrl(serviceType: 'libretranslate', url: string | null): void {
    try {
      if (url) {
        localStorage.setItem(`${serviceType}ApiUrl`, url)
      } else {
        localStorage.removeItem(`${serviceType}ApiUrl`)
      }
    } catch (error) {
      console.warn(`Failed to save ${serviceType} API URL:`, error)
    }
  }

  setLibreTranslateApiKey(key: string | null): void {
    this.saveApiKey('libretranslate', key)
    const provider = this.providers.get('libretranslate')
    if (provider) {
      provider.setApiKey(key)
    }
  }

  getLibreTranslateApiKey(): string | null {
    const provider = this.providers.get('libretranslate')
    return provider ? provider.getApiKey() : null
  }

  setLibreTranslateApiUrl(url: string | null): void {
    this.saveApiUrl('libretranslate', url)
    const provider = this.providers.get('libretranslate')
    if (provider && 'setApiUrl' in provider) {
      (provider as any).setApiUrl(url)
    }
  }

  getLibreTranslateApiUrl(): string | null {
    const provider = this.providers.get('libretranslate')
    if (provider && 'getApiUrl' in provider) {
      return (provider as any).getApiUrl()
    }
    return null
  }

  private loadServiceType(): void {
    try {
      const type = localStorage.getItem('translationServiceType')
      if (type === 'mymemory' || type === 'google' || type === 'libretranslate') {
        this.serviceType = type
      }
    } catch (error) {
      console.warn('Failed to load translation service type:', error)
    }
  }

  private saveServiceType(): void {
    try {
      localStorage.setItem('translationServiceType', this.serviceType)
    } catch (error) {
      console.warn('Failed to save translation service type:', error)
    }
  }

  setServiceType(type: TranslationServiceType): void {
    this.serviceType = type
    this.saveServiceType()
  }

  getServiceType(): TranslationServiceType {
    return this.serviceType
  }

  async translate(text: string, targetLang: Language = 'zh'): Promise<string> {
    if (!text.trim()) {
      return ''
    }

    const cached = this.cache.get(text, targetLang)
    if (cached) {
      return cached
    }

    await this.waitForRateLimit()

    try {
      const chunkSize = 450
      const chunks = this.splitTextIntoChunks(text, chunkSize)
      
      if (chunks.length === 1) {
        const result = await this.translateChunk(chunks[0], targetLang)
        this.cache.set(chunks[0], targetLang, result)
        this.saveCacheToStorage()
        return result
      }

      const translatedChunks: string[] = []
      for (const chunk of chunks) {
        const cachedChunk = this.cache.get(chunk, targetLang)
        if (cachedChunk) {
          translatedChunks.push(cachedChunk)
        } else {
          await this.waitForRateLimit()
          const result = await this.translateChunk(chunk, targetLang)
          this.cache.set(chunk, targetLang, result)
          translatedChunks.push(result)
          this.saveCacheToStorage()
        }
      }

      const combinedResult = translatedChunks.join('\n')
      this.cache.set(text, targetLang, combinedResult)
      this.saveCacheToStorage()
      return combinedResult
    } catch (error) {
      console.error('Translation service error:', error)
      throw this.handleError(error)
    }
  }

  private async waitForRateLimit(): Promise<void> {
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    
    if (timeSinceLastRequest < this.requestDelay) {
      const waitTime = this.requestDelay - timeSinceLastRequest
      await this.delay(waitTime)
    }
    
    this.lastRequestTime = Date.now()
  }

  private async translateChunk(text: string, targetLang: Language): Promise<string> {
    return this.translateChunkWithRetry(text, targetLang, 3)
  }

  private async translateChunkWithRetry(
    text: string, 
    targetLang: Language, 
    maxRetries: number,
    attempt: number = 1
  ): Promise<string> {
    try {
      const provider = this.providers.get(this.serviceType)
      if (!provider) {
        throw new Error(`Translation provider ${this.serviceType} not found`)
      }
      return await provider.translate(text, targetLang)
    } catch (error) {
      const translationError = error as any
      
      if (translationError && translationError.code) {
        if (translationError.code === 'RATE_LIMIT' && this.serviceType === 'libretranslate' && attempt === 1) {
          console.log('LibreTranslate rate limit exceeded, trying MyMemory as fallback')
          const myMemoryProvider = this.providers.get('mymemory')
          if (myMemoryProvider) {
            try {
              return await myMemoryProvider.translate(text, targetLang)
            } catch (myMemoryError) {
              console.warn('MyMemory also failed, trying Google Translate as fallback')
              const googleProvider = this.providers.get('google')
              if (googleProvider) {
                try {
                  return await googleProvider.translate(text, targetLang)
                } catch (googleError) {
                  console.warn('Google Translate also failed')
                  throw error
                }
              }
              throw error
            }
          }
        }
        
        if (translationError.code === 'RATE_LIMIT' && this.serviceType === 'mymemory' && attempt === 1) {
          console.log('MyMemory rate limit exceeded, trying LibreTranslate as fallback')
          const libreProvider = this.providers.get('libretranslate')
          if (libreProvider) {
            try {
              return await libreProvider.translate(text, targetLang)
            } catch (libreError) {
              console.warn('LibreTranslate also failed, trying Google Translate as fallback')
              const googleProvider = this.providers.get('google')
              if (googleProvider) {
                try {
                  return await googleProvider.translate(text, targetLang)
                } catch (googleError) {
                  console.warn('Google Translate also failed')
                  throw error
                }
              }
              throw error
            }
          }
        }
        
        if (translationError.code === 'API_ERROR' && (this.serviceType === 'google' || this.serviceType === 'libretranslate') && attempt === 1) {
          console.log(`${this.serviceType} API error, trying MyMemory as fallback`)
          const myMemoryProvider = this.providers.get('mymemory')
          if (myMemoryProvider) {
            try {
              return await myMemoryProvider.translate(text, targetLang)
            } catch (myMemoryError) {
              console.warn('MyMemory also failed')
              throw error
            }
          }
        }
        
        if (translationError.code === 'RATE_LIMIT' && attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 1000
          console.log(`Rate limit error, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
          await this.delay(waitTime)
          return this.translateChunkWithRetry(text, targetLang, maxRetries, attempt + 1)
        }
        throw error
      }
      
      if (attempt < maxRetries) {
        const waitTime = Math.pow(2, attempt) * 1000
        console.log(`Network error, waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`)
        await this.delay(waitTime)
        return this.translateChunkWithRetry(text, targetLang, maxRetries, attempt + 1)
      }
      
      throw this.createError(
        'Network error occurred. Please check your connection and try again.',
        'NETWORK_ERROR'
      )
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  private handleError(error: unknown): TranslationError {
    if (error && (error as any).code) {
      return error as TranslationError
    }
    if (error instanceof Error) {
      return this.createError(error.message, 'UNKNOWN')
    }
    return this.createError('An unknown error occurred', 'UNKNOWN')
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

  private splitTextIntoChunks(text: string, chunkSize: number): string[] {
    const chunks: string[] = []
    const lines = text.split('\n')
    let currentChunk = ''

    for (const line of lines) {
      if ((currentChunk + line).length > chunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk)
          currentChunk = ''
        }
        if (line.length > chunkSize) {
          const words = line.split(' ')
          let wordChunk = ''
          for (const word of words) {
            if ((wordChunk + word).length > chunkSize) {
              if (wordChunk) {
                chunks.push(wordChunk)
                wordChunk = ''
              }
              wordChunk = word + ' '
            } else {
              wordChunk += word + ' '
            }
          }
          if (wordChunk) {
            currentChunk = wordChunk
          }
        } else {
          currentChunk = line + '\n'
        }
      } else {
        currentChunk += line + '\n'
      }
    }

    if (currentChunk.trim()) {
      chunks.push(currentChunk)
    }

    return chunks
  }

  clearCache(): void {
    this.cache.clear()
  }
}

export const translationService = TranslationService.getInstance()