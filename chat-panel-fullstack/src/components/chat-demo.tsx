'use client';

import { ChatPanel } from '@/chat-panel-core';
import { Header } from './header';
import { MessageSquareIcon } from 'lucide-react';

// 默认模型列表（作为后备）
const DEFAULT_MODELS = [
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-5-haiku-20241022', label: 'Claude 3.5 Haiku' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
];

// 从环境变量加载模型列表
function getAvailableModels() {
  try {
    const modelsEnv = process.env.NEXT_PUBLIC_AVAILABLE_MODELS;
    if (modelsEnv) {
      const parsed = JSON.parse(modelsEnv);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (error) {
    console.warn('Failed to parse NEXT_PUBLIC_AVAILABLE_MODELS, using default models:', error);
  }
  return DEFAULT_MODELS;
}

// 获取默认模型
function getDefaultModel() {
  return process.env.NEXT_PUBLIC_DEFAULT_MODEL || 'claude-3-5-sonnet-20241022';
}

const MODELS = getAvailableModels();
const DEFAULT_MODEL = getDefaultModel();

export function ChatDemo() {
  return (
    <div className="flex h-screen flex-col">
      <Header />

      {/* Chat Panel */}
      <div className="flex-1 min-h-0">
        <ChatPanel
          sessionId="demo-session"
          config={{
            apiEndpoint: '/api/chat',
            title: 'AI Assistant',
            description: 'Ask me anything! I can help with calculations, time queries, and web searches.',
            placeholder: 'Type your message here...',
            models: MODELS,
            defaultModel: DEFAULT_MODEL,
            emptyStateIcon: (
              <div className="rounded-full bg-primary/10 p-4">
                <MessageSquareIcon className="h-8 w-8 text-primary" />
              </div>
            ),
          }}
        />
      </div>
    </div>
  );
}