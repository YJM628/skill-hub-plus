import { useState, useCallback } from 'react'
import FileTreeComponent from '../../../components/FileTree'
import type { FileTreeNode } from '../../../components/FileTree'
import { EditorPanel } from './editor/EditorPanel'
import { MarkdownPreview } from './preview/MarkdownPreview'
import { TranslatePanel } from './translate/TranslatePanel'
import { ChatPanel } from '@/chat-panel-core/components/chat/ChatPanel'
import type { ChatPanelConfig } from '@/chat-panel-core/types'

interface SkillDetailContentProps {
  viewMode: 'edit' | 'split' | 'preview' | 'translate' | 'optimize'
  showFileTree: boolean
  fileTree: FileTreeNode[]
  skillPath: string
  selectedFilePath: string
  content: string
  translatedContent: string
  translating: boolean
  translationError: string | null
  isRateLimitError: boolean
  optimizeSessionId: string
  optimizeChatConfig: ChatPanelConfig
  onFileSelect: (path: string) => void
  onContentChange: (content: string) => void
  onRetryTranslation: () => void
  onGoToSettings: () => void
  t: (key: string) => string
}

export function SkillDetailContent({
  viewMode,
  showFileTree,
  fileTree,
  skillPath,
  selectedFilePath,
  content,
  translatedContent,
  translating,
  translationError,
  isRateLimitError,
  optimizeSessionId,
  optimizeChatConfig,
  onFileSelect,
  onContentChange,
  onRetryTranslation,
  onGoToSettings,
  t
}: SkillDetailContentProps) {
  const [copied, setCopied] = useState(false)

  const handleCopyPath = useCallback(() => {
    if (!skillPath) return
    navigator.clipboard.writeText(skillPath).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [skillPath])

  return (
    <div className="h-full flex">
      {/* File Tree Sidebar */}
      {showFileTree && (
        <div className="w-64 border-r border-gray-800 bg-gray-900 overflow-auto">
          <div className="p-3 border-b border-gray-800">
            <div className="text-sm font-medium text-gray-300">Files</div>
            {skillPath && (
              <button
                onClick={handleCopyPath}
                className="mt-1 w-full text-left text-xs text-gray-500 truncate hover:text-gray-300 cursor-pointer transition-colors"
                title="Click to copy path"
              >
                {copied ? '✓ Copied!' : skillPath}
              </button>
            )}
          </div>
          <FileTreeComponent
            nodes={fileTree}
            selectedPath={selectedFilePath}
            onFileSelect={onFileSelect}
          />
        </div>
      )}

      {/* Editor */}
      {(viewMode === 'edit' || viewMode === 'split') && (
        <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} border-r border-gray-800`}>
          <EditorPanel
            content={content}
            onChange={onContentChange}
            placeholder={t('startWriting')}
            className="w-full h-full"
          />
        </div>
      )}

      {/* Preview */}
      {(viewMode === 'preview' || viewMode === 'split') && (
        <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} overflow-auto bg-gray-900`}>
          <MarkdownPreview content={content} />
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
          onRetry={onRetryTranslation}
          onGoToSettings={onGoToSettings}
          t={t}
        />
      )}

      {/* Optimize Mode - Split view with original content + AI Chat */}
      {viewMode === 'optimize' && (
        <>
          {/* Left: Original Content Preview */}
          <div className="w-1/2 border-r border-gray-800 overflow-auto bg-gray-900">
            <div className="p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span className="font-medium">{t('original')}</span>
              </div>
            </div>
            <MarkdownPreview content={content} />
          </div>

          {/* Right: AI Chat Panel with light theme for readability */}
          <div className="w-1/2 flex flex-col optimize-chat-panel">
            <ChatPanel
              sessionId={optimizeSessionId}
              config={optimizeChatConfig}
            />
          </div>
        </>
      )}
    </div>
  )
}
