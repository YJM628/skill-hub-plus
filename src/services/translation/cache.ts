import type { Language } from './types'

class TranslationCache {
  private cache: Map<string, string> = new Map()
  private maxSize = 100

  private generateKey(text: string, targetLang: Language): string {
    return `${targetLang}:${this.hashText(text)}`
  }

  private hashText(text: string): string {
    let hash = 0
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  get(text: string, targetLang: Language): string | null {
    const key = this.generateKey(text, targetLang)
    return this.cache.get(key) || null
  }

  set(text: string, targetLang: Language, translation: string): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    const key = this.generateKey(text, targetLang)
    this.cache.set(key, translation)
  }

  setRaw(key: string, value: string): void {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    this.cache.set(key, value)
  }

  getAllEntries(): [string, string][] {
    return Array.from(this.cache.entries())
  }

  clear(): void {
    this.cache.clear()
  }
}

export { TranslationCache }
