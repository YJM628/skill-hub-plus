import { useState, useCallback } from 'react'
import { translationService, TranslationError } from '../../services/translationService'
import type { Language } from '../../services/translationService'

interface UseTranslationParams {
  content: string
  targetLanguage: Language
}

interface UseTranslationReturn {
  translatedContent: string
  translating: boolean
  translationError: string | null
  isRateLimitError: boolean
  handleTranslate: () => Promise<void>
  resetTranslation: () => void
}

export function useTranslation({ content, targetLanguage }: UseTranslationParams): UseTranslationReturn {
  const [translatedContent, setTranslatedContent] = useState('')
  const [translating, setTranslating] = useState(false)
  const [translationError, setTranslationError] = useState<string | null>(null)
  const [isRateLimitError, setIsRateLimitError] = useState(false)

  const handleTranslate = useCallback(async () => {
    if (!content.trim()) return
    
    try {
      setTranslating(true)
      setTranslationError(null)
      setIsRateLimitError(false)
      const translated = await translationService.translate(content, targetLanguage)
      setTranslatedContent(translated)
    } catch (error) {
      let errorMessage = 'Translation failed'
      let isRateLimit = false
      
      if (error instanceof TranslationError) {
        if (error.code === 'RATE_LIMIT') {
          errorMessage = 'Rate limit exceeded'
          isRateLimit = true
        } else if (error.code === 'NETWORK_ERROR') {
          errorMessage = 'Network error'
        }
      }
      
      setTranslationError(errorMessage)
      setIsRateLimitError(isRateLimit)
      console.error('Translation failed:', error)
    } finally {
      setTranslating(false)
    }
  }, [content, targetLanguage])

  const resetTranslation = useCallback(() => {
    setTranslatedContent('')
    setTranslationError(null)
    setIsRateLimitError(false)
  }, [])

  return {
    translatedContent,
    translating,
    translationError,
    isRateLimitError,
    handleTranslate,
    resetTranslation
  }
}
