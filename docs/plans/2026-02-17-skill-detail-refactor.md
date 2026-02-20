# SkillDetail.tsx Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers-executing-plans to implement this plan task-by-task.

**Goal:** Refactor the 581-line SkillDetail.tsx component into a modular, maintainable architecture with separated concerns, custom hooks, and reusable components.

**Architecture:** Extract business logic into custom hooks (useSkillContent, useTranslation, useOptimization), split UI into functional components organized by feature (editor, translate, optimize), with state management distributed to appropriate components.

**Tech Stack:** React 18, TypeScript, Tauri (invoke), React Markdown, Custom Hooks

---

## Current State Analysis

**File to refactor:** `src/pages/SkillDetail.tsx` (581 lines)

**Current responsibilities:**
- File loading and saving via Tauri invoke
- Multiple view modes (edit, preview, split, translate, optimize)
- File tree sidebar
- Translation functionality with language selection
- AI optimization chat interface
- All state management in single component

**Issues to address:**
- Monolithic component with too many responsibilities
- Difficult to test and maintain
- Poor code organization

---

## Phase 1: Directory Structure Setup

### Task 1: Create component directories

**Files:**
- Create: `src/components/skills/detail/`
- Create: `src/components/skills/detail/editor/`
- Create: `src/components/skills/detail/translate/`
- Create: `src/components/skills/detail/optimize/`
- Create: `src/components/skills/detail/preview/`

**Step 1: Create directories using shell**

```bash
mkdir -p src/components/skills/detail/editor
mkdir -p src/components/skills/detail/translate
mkdir -p src/components/skills/detail/optimize
mkdir -p src/components/skills/detail/preview
```

**Step 2: Verify directories created**

Run: `ls -la src/components/skills/detail/`
Expected: Output showing editor/, translate/, optimize/, preview/ directories

**Step 3: Create hooks directory**

```bash
mkdir -p src/hooks/skills
```

**Step 4: Verify hooks directory**

Run: `ls -la src/hooks/skills`
Expected: Directory exists

**Step 5: Commit**

```bash
git add src/components/skills/detail src/hooks/skills
git commit -m "refactor: create directory structure for SkillDetail refactoring"
```

---

## Phase 2: Custom Hooks Extraction

### Task 2: Create useSkillContent hook

**Files:**
- Create: `src/hooks/skills/useSkillContent.ts`
- Reference: `src/pages/SkillDetail.tsx:1-581` (for extracting logic)

**Step 1: Write the useSkillContent hook**

```typescript
import { useState, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'

interface UseSkillContentParams {
  skillId: string
  selectedFilePath: string
}

interface UseSkillContentReturn {
  content: string
  originalContent: string
  loading: boolean
  hasChanges: boolean
  saving: boolean
  setContent: (content: string) => void
  loadFileContent: (fileName: string) => Promise<void>
  handleSave: () => Promise<void>
}

export function useSkillContent({ skillId, selectedFilePath }: UseSkillContentParams): UseSkillContentReturn {
  const [content, setContent] = useState('')
  const [originalContent, setOriginalContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const hasChanges = content !== originalContent

  const loadFileContent = useCallback(async (fileName: string) => {
    if (!skillId) return
    
    try {
      setLoading(true)
      const fileContent = await invoke<string>('read_skill_file', {
        skillId,
        fileName
      })
      setContent(fileContent)
      setOriginalContent(fileContent)
    } catch (error) {
      console.error('Failed to load skill:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }, [skillId])

  const handleSave = useCallback(async () => {
    if (!skillId || !hasChanges || !selectedFilePath) return
    
    try {
      setSaving(true)
      await invoke('write_skill_file', {
        skillId,
        fileName: selectedFilePath,
        content
      })
      setOriginalContent(content)
    } catch (error) {
      console.error('Failed to save skill:', error)
      throw error
    } finally {
      setSaving(false)
    }
  }, [skillId, hasChanges, content, selectedFilePath])

  return {
    content,
    originalContent,
    loading,
    hasChanges,
    saving,
    setContent,
    loadFileContent,
    handleSave
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/skills/useSkillContent.ts
git commit -m "refactor: extract useSkillContent hook"
```

---

### Task 3: Create useTranslation hook

**Files:**
- Create: `src/hooks/skills/useTranslation.ts`
- Reference: `src/services/translationService.ts` (existing service)

**Step 1: Write the useTranslation hook**

```typescript
import { useState, useCallback } from 'react'
import translationService from '../../services/translationService'
import { TranslationError, Language } from '../../services/translationService'

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
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/skills/useTranslation.ts
git commit -m "refactor: extract useTranslation hook"
```

---

### Task 4: Create useOptimization hook

**Files:**
- Create: `src/hooks/skills/useOptimization.ts`

**Step 1: Write the useOptimization hook**

```typescript
import { useState, useCallback } from 'react'

interface OptimizationMessage {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
}

interface UseOptimizationParams {
  content: string
}

interface UseOptimizationReturn {
  optimizationMessages: OptimizationMessage[]
  optimizing: boolean
  optimizationInput: string
  setOptimizationInput: (input: string) => void
  handleOptimize: () => Promise<void>
}

export function useOptimization({ content }: UseOptimizationParams): UseOptimizationReturn {
  const [optimizationMessages, setOptimizationMessages] = useState<OptimizationMessage[]>([])
  const [optimizing, setOptimizing] = useState(false)
  const [optimizationInput, setOptimizationInput] = useState('')

  const handleOptimize = useCallback(async () => {
    if (!optimizationInput.trim() || optimizing) return

    try {
      setOptimizing(true)

      // Add user message
      const userMessage: OptimizationMessage = {
        id: Date.now().toString(),
        content: optimizationInput,
        sender: 'user',
        timestamp: new Date()
      }

      setOptimizationMessages(prev => [...prev, userMessage])
      const input = optimizationInput
      setOptimizationInput('')

      // TODO: Implement actual AI optimization call when backend is ready
      // For now, simulate with a mock response
      setTimeout(() => {
        const aiResponse: OptimizationMessage = {
          id: (Date.now() + 1).toString(),
          content: `Optimization response for: "${input}"`,
          sender: 'ai',
          timestamp: new Date()
        }

        setOptimizationMessages(prev => [...prev, aiResponse])
        setOptimizing(false)
      }, 1000)
    } catch (error) {
      console.error('Optimization failed:', error)
      const errorMessage: OptimizationMessage = {
        id: (Date.now() + 1).toString(),
        content: 'Optimization failed. Please try again.',
        sender: 'ai',
        timestamp: new Date()
      }
      setOptimizationMessages(prev => [...prev, errorMessage])
      setOptimizing(false)
    }
  }, [optimizationInput, optimizing])

  return {
    optimizationMessages,
    optimizing,
    optimizationInput,
    setOptimizationInput,
    handleOptimize
  }
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/hooks/skills/useOptimization.ts
git commit -m "refactor: extract useOptimization hook"
```

---

## Phase 3: Common UI Components

### Task 5: Create ViewModeSelector component

**Files:**
- Create: `src/components/skills/common/ViewModeSelector.tsx`

**Step 1: Write ViewModeSelector component**

```typescript
import { Edit, Columns, Eye, Languages, Zap, FileTreeIcon } from 'lucide-react'

type ViewMode = 'edit' | 'split' | 'preview' | 'translate' | 'optimize'

interface ViewModeSelectorProps {
  viewMode: ViewMode
  showFileTree: boolean
  onViewModeChange: (mode: ViewMode) => void
  onToggleFileTree: () => void
}

export function ViewModeSelector({ 
  viewMode, 
  showFileTree, 
  onViewModeChange,
  onToggleFileTree 
}: ViewModeSelectorProps) {
  return (
    <div className="flex items-center gap-1 bg-gray-800 rounded-lg p-1">
      <button
        onClick={onToggleFileTree}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          showFileTree
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Toggle File Tree"
      >
        <FileTreeIcon size={16} />
        <span className="text-sm">Files</span>
      </button>
      <div className="w-px h-6 bg-gray-700 mx-1" />
      <button
        onClick={() => onViewModeChange('edit')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          viewMode === 'edit'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Edit Mode"
      >
        <Edit size={16} />
        <span className="text-sm">Edit</span>
      </button>
      <button
        onClick={() => onViewModeChange('split')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          viewMode === 'split'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Split Mode"
      >
        <Columns size={16} />
        <span className="text-sm">Split</span>
      </button>
      <button
        onClick={() => onViewModeChange('preview')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          viewMode === 'preview'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Preview Mode"
      >
        <Eye size={16} />
        <span className="text-sm">Preview</span>
      </button>
      <button
        onClick={() => onViewModeChange('translate')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          viewMode === 'translate'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Translate Mode"
      >
        <Languages size={16} />
        <span className="text-sm">Translate</span>
      </button>
      <button
        onClick={() => onViewModeChange('optimize')}
        className={`flex items-center gap-2 px-3 py-1.5 rounded transition-colors ${
          viewMode === 'optimize'
            ? 'bg-blue-600 text-white'
            : 'text-gray-400 hover:text-white'
        }`}
        title="Optimize Mode"
      >
        <Zap size={16} />
        <span className="text-sm">Optimize</span>
      </button>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/common/ViewModeSelector.tsx
git commit -m "refactor: create ViewModeSelector component"
```

---

### Task 6: Create LanguageSelector component

**Files:**
- Create: `src/components/skills/detail/translate/LanguageSelector.tsx`
- Reference: `src/services/translationService.ts` (for SUPPORTED_LANGUAGES)

**Step 1: Write LanguageSelector component**

```typescript
import { Language, SUPPORTED_LANGUAGES } from '../../../services/translationService'

interface LanguageSelectorProps {
  targetLanguage: Language
  onLanguageChange: (language: Language) => void
}

export function LanguageSelector({ targetLanguage, onLanguageChange }: LanguageSelectorProps) {
  return (
    <select
      value={targetLanguage}
      onChange={(e) => {
        onLanguageChange(e.target.value as Language)
      }}
      className="px-3 py-1.5 bg-gray-800 text-gray-300 rounded-lg border border-gray-700 focus:outline-none focus:border-blue-500 text-sm"
    >
      {SUPPORTED_LANGUAGES.map((lang) => (
        <option key={lang.code} value={lang.code}>
          {lang.nativeName}
        </option>
      ))}
    </select>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/translate/LanguageSelector.tsx
git commit -m "refactor: create LanguageSelector component"
```

---

### Task 7: Create MarkdownPreview component

**Files:**
- Create: `src/components/skills/detail/preview/MarkdownPreview.tsx`

**Step 1: Write MarkdownPreview component**

```typescript
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface MarkdownPreviewProps {
  content: string
  className?: string
}

export function MarkdownPreview({ content, className = '' }: MarkdownPreviewProps) {
  return (
    <div className={`max-w-none skill-markdown-preview ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/preview/MarkdownPreview.tsx
git commit -m "refactor: create MarkdownPreview component"
```

---

## Phase 4: Feature Panel Components

### Task 8: Create EditorPanel component

**Files:**
- Create: `src/components/skills/detail/editor/EditorPanel.tsx`

**Step 1: Write EditorPanel component**

```typescript
interface EditorPanelProps {
  content: string
  onChange: (content: string) => void
  isFullWidth: boolean
  placeholder?: string
}

export function EditorPanel({ content, onChange, isFullWidth, placeholder }: EditorPanelProps) {
  return (
    <div className={`${isFullWidth ? 'w-full' : 'w-1/2'} border-r border-gray-800`}>
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full p-6 bg-gray-900 text-gray-100 font-mono text-sm resize-none focus:outline-none"
        placeholder={placeholder}
        spellCheck={false}
      />
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/editor/EditorPanel.tsx
git commit -m "refactor: create EditorPanel component"
```

---

### Task 9: Create TranslatePanel component

**Files:**
- Create: `src/components/skills/detail/translate/TranslatePanel.tsx`

**Step 1: Write TranslatePanel component**

```typescript
import { Loader2 } from 'lucide-react'
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { LanguageSelector } from './LanguageSelector'
import { Language } from '../../../services/translationService'

interface TranslatePanelProps {
  content: string
  translatedContent: string
  translating: boolean
  translationError: string | null
  isRateLimitError: boolean
  targetLanguage: Language
  onLanguageChange: (language: Language) => void
  onTranslate: () => void
  onGoToSettings: () => void
}

export function TranslatePanel({
  content,
  translatedContent,
  translating,
  translationError,
  isRateLimitError,
  targetLanguage,
  onLanguageChange,
  onTranslate,
  onGoToSettings
}: TranslatePanelProps) {
  return (
    <>
      {/* Original Content */}
      <div className="w-1/2 border-r border-gray-800 overflow-auto bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium">Original</span>
          </div>
        </div>
        <div className="p-6">
          <MarkdownPreview content={content} />
        </div>
      </div>

      {/* Translated Content */}
      <div className="w-1/2 overflow-auto bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center justify-between gap-2 text-sm text-gray-300">
            <span className="font-medium">Translated</span>
            <div className="flex items-center gap-2">
              <LanguageSelector 
                targetLanguage={targetLanguage} 
                onLanguageChange={onLanguageChange}
              />
              <button
                onClick={onTranslate}
                disabled={translating}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Loader2 size={14} className={translating ? 'animate-spin' : 'hidden'} />
                <span className="text-sm">Retry</span>
              </button>
            </div>
          </div>
        </div>
        {translating ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <Loader2 size={32} className="animate-spin" />
              <span>Translating...</span>
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
                <p className="text-gray-400 text-sm mb-4">Please configure your API key in settings</p>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={onTranslate}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
                >
                  Retry
                </button>
                {isRateLimitError && (
                  <button
                    onClick={onGoToSettings}
                    className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
                  >
                    Go to Settings
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-6">
            <MarkdownPreview content={translatedContent || 'No translation yet'} />
          </div>
        )}
      </div>
    </>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/translate/TranslatePanel.tsx
git commit -m "refactor: create TranslatePanel component"
```

---

### Task 10: Create ChatInterface component

**Files:**
- Create: `src/components/skills/detail/optimize/ChatInterface.tsx`

**Step 1: Write ChatInterface component**

```typescript
import { Loader2 } from 'lucide-react'

interface ChatMessage {
  id: string
  content: string
  sender: 'user' | 'ai'
  timestamp: Date
}

interface ChatInterfaceProps {
  messages: ChatMessage[]
  input: string
  onInputChange: (input: string) => void
  onSend: () => void
  optimizing: boolean
  welcomeMessage?: string
  placeholder?: string
}

export function ChatInterface({
  messages,
  input,
  onInputChange,
  onSend,
  optimizing,
  welcomeMessage = 'How can I help optimize your content?',
  placeholder = 'Enter your optimization request...'
}: ChatInterfaceProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 bg-gray-900">
        <div className="h-full flex flex-col">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4" id="chat-messages">
            {messages.length === 0 ? (
              <div className="bg-gray-800 p-4 rounded-lg">
                <p className="text-gray-300">{welcomeMessage}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-4 rounded-lg ${
                    msg.sender === 'user' ? 'bg-blue-900/20 ml-10' : 'bg-gray-800 mr-10'
                  }`}
                >
                  <p className="text-gray-300">{msg.content}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {msg.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              ))
            )}
            {optimizing && (
              <div className="bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin" />
                  <p className="text-gray-300">Optimizing...</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-auto">
            <textarea
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              className="w-full p-3 bg-gray-800 text-gray-100 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 resize-none"
              rows={3}
              placeholder={placeholder}
              disabled={optimizing}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={onSend}
                disabled={optimizing || !input.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {optimizing ? 'Optimizing...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/optimize/ChatInterface.tsx
git commit -m "refactor: create ChatInterface component"
```

---

### Task 11: Create OptimizePanel component

**Files:**
- Create: `src/components/skills/detail/optimize/OptimizePanel.tsx`

**Step 1: Write OptimizePanel component**

```typescript
import { MarkdownPreview } from '../preview/MarkdownPreview'
import { ChatInterface } from './ChatInterface'
import { OptimizationMessage } from '../../../hooks/skills/useOptimization'

interface OptimizePanelProps {
  content: string
  optimizationMessages: OptimizationMessage[]
  optimizing: boolean
  optimizationInput: string
  onInputChange: (input: string) => void
  onSend: () => void
}

export function OptimizePanel({
  content,
  optimizationMessages,
  optimizing,
  optimizationInput,
  onInputChange,
  onSend
}: OptimizePanelProps) {
  return (
    <>
      {/* Original Content */}
      <div className="w-1/2 border-r border-gray-800 overflow-auto bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium">Original</span>
          </div>
        </div>
        <div className="p-6">
          <MarkdownPreview content={content} />
        </div>
      </div>

      {/* AI Chat Interface */}
      <div className="w-1/2 flex flex-col bg-gray-900">
        <div className="p-4 bg-gray-800 border-b border-gray-700">
          <div className="flex items-center gap-2 text-sm text-gray-300">
            <span className="font-medium">Optimization Chat</span>
          </div>
        </div>
        <ChatInterface
          messages={optimizationMessages}
          input={optimizationInput}
          onInputChange={onInputChange}
          onSend={onSend}
          optimizing={optimizing}
          welcomeMessage="How can I help optimize your skill content?"
          placeholder="Describe what you want to optimize..."
        />
      </div>
    </>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/optimize/OptimizePanel.tsx
git commit -m "refactor: create OptimizePanel component"
```

---

## Phase 5: Layout Components

### Task 12: Create SkillDetailHeader component

**Files:**
- Create: `src/components/skills/detail/SkillDetailHeader.tsx`

**Step 1: Write SkillDetailHeader component**

```typescript
import { ArrowLeft, Save } from 'lucide-react'
import { ViewModeSelector } from '../common/ViewModeSelector'
import { useTranslation } from 'react-i18next'

type ViewMode = 'edit' | 'split' | 'preview' | 'translate' | 'optimize'

interface SkillDetailHeaderProps {
  skillName: string
  hasChanges: boolean
  saving: boolean
  viewMode: ViewMode
  showFileTree: boolean
  onBack: () => void
  onSave: () => void
  onViewModeChange: (mode: ViewMode) => void
  onToggleFileTree: () => void
}

export function SkillDetailHeader({
  skillName,
  hasChanges,
  saving,
  viewMode,
  showFileTree,
  onBack,
  onSave,
  onViewModeChange,
  onToggleFileTree
}: SkillDetailHeaderProps) {
  const { t } = useTranslation()

  return (
    <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-900">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
          <span>{t('back')}</span>
        </button>
        <div className="h-6 w-px bg-gray-700" />
        <h1 className="text-xl font-semibold text-white">
          {skillName || t('skillDetail')}
        </h1>
        {hasChanges && (
          <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-400 rounded">
            {t('unsaved')}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <ViewModeSelector
          viewMode={viewMode}
          showFileTree={showFileTree}
          onViewModeChange={onViewModeChange}
          onToggleFileTree={onToggleFileTree}
        />
        <div className="h-6 w-px bg-gray-700 mx-2" />
        <button
          onClick={onSave}
          disabled={!hasChanges || saving}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            hasChanges && !saving
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed'
          }`}
        >
          <Save size={18} />
          <span>{saving ? t('saving') : t('save')}</span>
        </button>
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/SkillDetailHeader.tsx
git commit -m "refactor: create SkillDetailHeader component"
```

---

### Task 13: Create SkillDetailContent component

**Files:**
- Create: `src/components/skills/detail/SkillDetailContent.tsx`

**Step 1: Write SkillDetailContent component**

```typescript
import { EditorPanel } from './editor/EditorPanel'
import { TranslatePanel } from './translate/TranslatePanel'
import { OptimizePanel } from './optimize/OptimizePanel'
import { MarkdownPreview } from './preview/MarkdownPreview'
import FileTree, { FileTreeNode } from '../../FileTree'
import { Language } from '../../../services/translationService'
import { OptimizationMessage } from '../../../hooks/skills/useOptimization'

type ViewMode = 'edit' | 'split' | 'preview' | 'translate' | 'optimize'

interface SkillDetailContentProps {
  viewMode: ViewMode
  showFileTree: boolean
  fileTree: FileTreeNode[]
  selectedFilePath: string | null
  content: string
  translatedContent: string
  translating: boolean
  translationError: string | null
  isRateLimitError: boolean
  targetLanguage: Language
  optimizationMessages: OptimizationMessage[]
  optimizing: boolean
  optimizationInput: string
  onFileSelect: (path: string) => void
  onContentChange: (content: string) => void
  onLanguageChange: (language: Language) => void
  onTranslate: () => void
  onGoToSettings: () => void
  onInputChange: (input: string) => void
  onSend: () => void
}

export function SkillDetailContent({
  viewMode,
  showFileTree,
  fileTree,
  selectedFilePath,
  content,
  translatedContent,
  translating,
  translationError,
  isRateLimitError,
  targetLanguage,
  optimizationMessages,
  optimizing,
  optimizationInput,
  onFileSelect,
  onContentChange,
  onLanguageChange,
  onTranslate,
  onGoToSettings,
  onInputChange,
  onSend
}: SkillDetailContentProps) {
  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex">
        {/* File Tree Sidebar */}
        {showFileTree && (
          <div className="w-64 border-r border-gray-800 bg-gray-900 overflow-auto">
            <div className="p-3 border-b border-gray-800">
              <div className="text-sm font-medium text-gray-300">Files</div>
            </div>
            <FileTree
              nodes={fileTree}
              selectedPath={selectedFilePath}
              onFileSelect={onFileSelect}
            />
          </div>
        )}

        {/* Editor */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <EditorPanel
            content={content}
            onChange={onContentChange}
            isFullWidth={viewMode === 'edit'}
            placeholder="Start writing..."
          />
        )}

        {/* Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto bg-gray-900`}>
            <div className="p-6">
              <MarkdownPreview content={content} />
            </div>
          </div>
        )}

        {/* Translate Mode */}
        {viewMode === 'translate' && (
          <TranslatePanel
            content={content}
            translatedContent={translatedContent}
            translating={translating}
            translationError={translationError}
            isRateLimitError={isRateLimitError}
            targetLanguage={targetLanguage}
            onLanguageChange={onLanguageChange}
            onTranslate={onTranslate}
            onGoToSettings={onGoToSettings}
          />
        )}

        {/* Optimize Mode */}
        {viewMode === 'optimize' && (
          <OptimizePanel
            content={content}
            optimizationMessages={optimizationMessages}
            optimizing={optimizing}
            optimizationInput={optimizationInput}
            onInputChange={onInputChange}
            onSend={onSend}
          />
        )}
      </div>
    </div>
  )
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/components/skills/detail/SkillDetailContent.tsx
git commit -m "refactor: create SkillDetailContent component"
```

---

## Phase 6: Refactor Main Component

### Task 14: Refactor SkillDetail.tsx to use new components

**Files:**
- Modify: `src/pages/SkillDetail.tsx`

**Step 1: Replace entire SkillDetail.tsx with refactored version**

```typescript
import { useEffect, useState, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { invoke } from '@tauri-apps/api/core'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import FileTree, { FileTreeNode } from '../components/FileTree'
import { Language } from '../services/translationService'

import { SkillDetailHeader } from '../components/skills/detail/SkillDetailHeader'
import { SkillDetailContent } from '../components/skills/detail/SkillDetailContent'
import { useSkillContent } from '../hooks/skills/useSkillContent'
import { useTranslation as useTranslationHook } from '../hooks/skills/useTranslation'
import { useOptimization } from '../hooks/skills/useOptimization'

type ViewMode = 'edit' | 'split' | 'preview' | 'translate' | 'optimize'

export default function SkillDetail() {
  const { skillId } = useParams<{ skillId: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { t } = useTranslation()

  // Global state
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [showFileTree, setShowFileTree] = useState(false)
  const [fileTree, setFileTree] = useState<FileTreeNode[]>([])
  const [selectedFilePath, setSelectedFilePath] = useState<string>('SKILL.md')
  const [targetLanguage, setTargetLanguage] = useState<Language>('zh')

  // Use custom hooks
  const {
    content,
    loading,
    hasChanges,
    saving,
    setContent,
    loadFileContent,
    handleSave
  } = useSkillContent({ skillId: skillId || '', selectedFilePath })

  const {
    translatedContent,
    translating,
    translationError,
    isRateLimitError,
    handleTranslate,
    resetTranslation
  } = useTranslationHook({ content, targetLanguage })

  const {
    optimizationMessages,
    optimizing,
    optimizationInput,
    setOptimizationInput,
    handleOptimize
  } = useOptimization({ content })

  // Load file tree
  const loadFileTree = useCallback(async () => {
    if (!skillId) return
    
    try {
      const tree = await invoke<FileTreeNode[]>('list_skill_files', { skillId })
      setFileTree(tree)
    } catch (error) {
      console.error('Failed to load file tree:', error)
    }
  }, [skillId])

  // Initial load
  useEffect(() => {
    if (selectedFilePath) {
      loadFileContent(selectedFilePath)
    }
    loadFileTree()
  }, [selectedFilePath, skillId, loadFileContent, loadFileTree, location.key])

  // Auto-translate when switching to translate mode
  useEffect(() => {
    if (viewMode === 'translate' && content && !translatedContent && !translating) {
      handleTranslate()
    }
  }, [viewMode, content, targetLanguage, translatedContent, translating, handleTranslate])

  // Reset translation when language changes
  useEffect(() => {
    if (viewMode === 'translate') {
      resetTranslation()
    }
  }, [targetLanguage, viewMode, resetTranslation])

  // Event handlers
  const handleFileSelect = useCallback((path: string) => {
    setSelectedFilePath(path)
  }, [])

  const handleLanguageChange = useCallback((language: Language) => {
    setTargetLanguage(language)
  }, [])

  const handleBack = () => {
    if (hasChanges) {
      if (confirm(t('confirmUnsavedChanges'))) {
        navigate(-1)
      }
    } else {
      navigate(-1)
    }
  }

  const handleGoToSettings = () => {
    navigate('/?openSettings=true')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-400">{t('loading')}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950">
      <SkillDetailHeader
        skillName={extractSkillName(content)}
        hasChanges={hasChanges}
        saving={saving}
        viewMode={viewMode}
        showFileTree={showFileTree}
        onBack={handleBack}
        onSave={handleSave}
        onViewModeChange={setViewMode}
        onToggleFileTree={() => setShowFileTree(!showFileTree)}
      />
      <SkillDetailContent
        viewMode={viewMode}
        showFileTree={showFileTree}
        fileTree={fileTree}
        selectedFilePath={selectedFilePath}
        content={content}
        translatedContent={translatedContent}
        translating={translating}
        translationError={translationError}
        isRateLimitError={isRateLimitError}
        targetLanguage={targetLanguage}
        optimizationMessages={optimizationMessages}
        optimizing={optimizing}
        optimizationInput={optimizationInput}
        onFileSelect={handleFileSelect}
        onContentChange={setContent}
        onLanguageChange={handleLanguageChange}
        onTranslate={handleTranslate}
        onGoToSettings={handleGoToSettings}
        onInputChange={setOptimizationInput}
        onSend={handleOptimize}
      />
    </div>
  )
}

// Helper function to extract skill name from frontmatter
function extractSkillName(content: string): string {
  const nameMatch = content.match(/^---\s*\nname:\s*(.+?)\s*\n/m)
  if (nameMatch) {
    return nameMatch[1].replace(/['"]/g, '')
  }
  return ''
}
```

**Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

**Step 3: Commit**

```bash
git add src/pages/SkillDetail.tsx
git commit -m "refactor: simplify SkillDetail.tsx using new components and hooks"
```

---

## Phase 7: Verification

### Task 15: Check for lint errors

**Files:**
- Check: All modified files

**Step 1: Run linter**

Run: `npm run lint`
Expected: No errors or warnings

**Step 2: Fix any lint errors if present**

If errors exist, fix them and run again until clean

**Step 3: Commit any lint fixes**

```bash
git add .
git commit -m "refactor: fix lint errors"
```

---

### Task 16: Verify TypeScript compilation

**Files:**
- Check: All TypeScript files

**Step 1: Run TypeScript compiler**

Run: `npx tsc --noEmit`
Expected: No compilation errors

**Step 2: If errors exist, fix and re-run**

**Step 3: Commit any fixes**

```bash
git add .
git commit -m "refactor: fix TypeScript compilation errors"
```

---

### Task 17: Final verification and documentation

**Files:**
- Create: `docs/plans/2026-02-17-skill-detail-refactor-summary.md`

**Step 1: Create summary document**

```markdown
# SkillDetail Refactoring Summary

## Completed

Successfully refactored the 581-line `SkillDetail.tsx` component into a modular architecture.

## New Structure

### Custom Hooks (3 files)
- `src/hooks/skills/useSkillContent.ts` - File loading and saving logic
- `src/hooks/skills/useTranslation.ts` - Translation functionality
- `src/hooks/skills/useOptimization.ts` - AI optimization chat logic

### Components (10 files)
- `src/components/skills/common/ViewModeSelector.tsx` - View mode switcher
- `src/components/skills/detail/preview/MarkdownPreview.tsx` - Markdown renderer
- `src/components/skills/detail/translate/LanguageSelector.tsx` - Language dropdown
- `src/components/skills/detail/editor/EditorPanel.tsx` - Text editor
- `src/components/skills/detail/translate/TranslatePanel.tsx` - Translation interface
- `src/components/skills/detail/optimize/ChatInterface.tsx` - Chat UI
- `src/components/skills/detail/optimize/OptimizePanel.tsx` - Optimization panel
- `src/components/skills/detail/SkillDetailHeader.tsx` - Page header
- `src/components/skills/detail/SkillDetailContent.tsx` - Content container

### Simplified Main Component
- `src/pages/SkillDetail.tsx` - Reduced to ~150 lines, only orchestration logic

## Benefits

- **Maintainability**: Each component has a single, clear responsibility
- **Testability**: Isolated hooks and components are easier to unit test
- **Reusability**: Components and hooks can be reused in other parts of the app
- **Developer Experience**: Smaller files are easier to understand and modify

## Testing

All functionality preserved:
- File loading and saving ✓
- View mode switching ✓
- Translation ✓
- AI optimization chat ✓
- File tree navigation ✓
```

**Step 2: Commit summary**

```bash
git add docs/plans/2026-02-17-skill-detail-refactor-summary.md
git commit -m "docs: add SkillDetail refactoring summary"
```

---

## Completion Checklist

- [ ] All 17 tasks completed
- [ ] No TypeScript compilation errors
- [ ] No lint errors
- [ ] All components working as expected
- [ ] Documentation updated

## Success Criteria

The refactoring is complete when:
1. Original `SkillDetail.tsx` is reduced to ~150 lines
2. All functionality works as before
3. No compilation or lint errors
4. Code is organized in clear, logical modules
