'use client';

import { useState, useCallback } from 'react';
import type { Message, ToolUseInfo, ToolResultInfo, PermissionRequestEvent, ChatPanelConfig } from '@/chat-panel-core/types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { useChatMessages } from '@/chat-panel-core/hooks/useChatMessages';
import { useChatStreaming } from '@/chat-panel-core/hooks/useChatStreaming';
import { executeBuiltInCommand } from '@/chat-panel-core/config/commands';

const DEFAULT_MODELS = [
  { value: 'sonnet', label: 'Sonnet 4.5' },
  { value: 'opus', label: 'Opus 4' },
  { value: 'haiku', label: 'Haiku 3.5' },
];

interface ChatPanelProps {
  sessionId: string;
  initialMessages?: Message[];
  config?: ChatPanelConfig;
}

export function ChatPanel({ sessionId, initialMessages = [], config = {} }: ChatPanelProps) {
  const {
    apiEndpoint = '/api/chat',
    title = 'AI Chat',
    description = 'Start a conversation. Ask questions, get help with code, or explore ideas.',
    emptyStateIcon,
    placeholder = 'Message AI...',
    models = DEFAULT_MODELS,
    defaultModel = 'sonnet',
    suggestions = [
      { value: 'create-skill', label: 'Create Skill', description: '帮我创建这个skill' },
      { value: 'optimize-skill', label: 'Optimize skill', description: '帮我优化这个skill' }
    ],
  } = config;

  const { messages, addMessage } = useChatMessages({ initialMessages });

  const [currentModel, setCurrentModel] = useState(defaultModel);
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolUses, setToolUses] = useState<ToolUseInfo[]>([]);
  const [toolResults, setToolResults] = useState<ToolResultInfo[]>([]);
  const [statusText, setStatusText] = useState<string | undefined>();
  const [streamingToolOutput, setStreamingToolOutput] = useState('');
  const [pendingPermission, setPendingPermission] = useState<PermissionRequestEvent | null>(null);
  const [permissionResolved, setPermissionResolved] = useState<'allow' | 'deny' | null>(null);

  const handleCommand = useCallback((command: string) => {
    // Handle built-in commands using the unified command configuration
    const handled = executeBuiltInCommand(command, sessionId, addMessage);

    if (!handled) {
      // For other commands, let them be handled by the AI
      console.log('Command not handled locally:', command);
    }
  }, [addMessage, sessionId]);

  const handlePermissionResponse = useCallback((decision: 'allow' | 'allow_session' | 'deny') => {
    if (!pendingPermission) return;
    const resolved = decision === 'deny' ? 'deny' : 'allow';
    setPermissionResolved(resolved);

    fetch('/api/chat/permission', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissionRequestId: pendingPermission.permissionRequestId,
        decision: resolved,
      }),
    }).catch(() => { /* silent */ });
  }, [pendingPermission]);

  const { sendMessage, stopStreaming } = useChatStreaming({
    sessionId,
    apiEndpoint,
    currentModel,
    onStreamingStateChange: setIsStreaming,
    onStreamingContentChange: setStreamingContent,
    onToolUsesChange: setToolUses as any,
    onToolResultsChange: setToolResults as any,
    onStreamingToolOutputChange: setStreamingToolOutput as any,
    onStatusTextChange: setStatusText,
    onMessageAdd: addMessage,
    onPendingPermissionChange: setPendingPermission,
    onPermissionResolvedChange: setPermissionResolved,
    isStreaming,
  });

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <MessageList
        messages={messages}
        streamingContent={streamingContent}
        isStreaming={isStreaming}
        toolUses={toolUses}
        toolResults={toolResults}
        streamingToolOutput={streamingToolOutput}
        statusText={statusText}
        pendingPermission={pendingPermission}
        onPermissionResponse={handlePermissionResponse}
        permissionResolved={permissionResolved}
        emptyStateTitle={title}
        emptyStateDescription={description}
        emptyStateIcon={emptyStateIcon}
      />
      <MessageInput
        onSend={sendMessage}
        onCommand={handleCommand}
        onStop={stopStreaming}
        disabled={false}
        isStreaming={isStreaming}
        placeholder={placeholder}
        modelName={currentModel}
        onModelChange={setCurrentModel}
        models={models}
        suggestions={suggestions}
      />
    </div>
  );
}
