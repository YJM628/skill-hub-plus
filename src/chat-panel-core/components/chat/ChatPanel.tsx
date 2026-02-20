import { useState, useCallback, useEffect } from 'react';
import type { Message, ToolUseInfo, ToolResultInfo, PermissionRequestEvent, ChatPanelConfig } from '@/chat-panel-core/types';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ChatHeader } from './ChatHeader';
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
  onSessionChange?: (sessionId: string) => void;
}

export function ChatPanel({ sessionId, initialMessages = [], config = {}, onSessionChange }: ChatPanelProps) {
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
    systemContext,
    defaultWorkingDirectory,
  } = config;

  const { messages, addMessage, setMessages } = useChatMessages({ initialMessages });

  const [currentSessionId, setCurrentSessionId] = useState(sessionId);
  const [currentModel, setCurrentModel] = useState(defaultModel);
  const [workingDirectory, setWorkingDirectory] = useState<string>(defaultWorkingDirectory || '');
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [toolUses, setToolUses] = useState<ToolUseInfo[]>([]);
  const [toolResults, setToolResults] = useState<ToolResultInfo[]>([]);
  const [statusText, setStatusText] = useState<string | undefined>();
  const [streamingToolOutput, setStreamingToolOutput] = useState('');
  const [pendingPermission, setPendingPermission] = useState<PermissionRequestEvent | null>(null);
  const [permissionResolved, setPermissionResolved] = useState<'allow' | 'deny' | null>(null);

  // Auto-load historical messages when session changes
  useEffect(() => {
    const loadHistoryMessages = async () => {
      if (!currentSessionId) return;
      
      try {
        const response = await fetch(`/api/chat/messages?session_id=${encodeURIComponent(currentSessionId)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.messages && Array.isArray(data.messages)) {
            // Convert backend messages to frontend Message format
            const historyMessages: Message[] = data.messages.map((msg: { role: string; content: string }) => ({
              id: `history-${Date.now()}-${Math.random()}`,
              session_id: currentSessionId,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              created_at: new Date().toISOString(),
            }));
            
            // Always set messages when session changes
            setMessages(historyMessages);
          } else {
            // No messages for this session, clear the messages
            setMessages([]);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // On error, clear messages to avoid showing wrong session's messages
        setMessages([]);
      }
    };

    loadHistoryMessages();
  }, [currentSessionId, setMessages]);

  // Update current session when prop changes
  useEffect(() => {
    setCurrentSessionId(sessionId);
  }, [sessionId]);

  // Clean up streaming state when session changes
  useEffect(() => {
    // Reset all streaming-related states when switching sessions
    setStreamingContent('');
    setToolUses([]);
    setToolResults([]);
    setStreamingToolOutput('');
    setStatusText(undefined);
    setPendingPermission(null);
    setPermissionResolved(null);
    
    // Stop any ongoing streaming
    if (isStreaming) {
      stopStreaming();
      setIsStreaming(false);
    }
  }, [currentSessionId]); // Only depend on currentSessionId, not the setter functions

  const handleNewSession = useCallback(async () => {
    try {
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session?.id) {
          // Simply update the session ID, the useEffect will handle clearing messages
          setCurrentSessionId(data.session.id);
          onSessionChange?.(data.session.id);
        }
      }
    } catch (error) {
      console.error('Failed to create new session:', error);
    }
  }, [onSessionChange]);

  const handleSwitchSession = useCallback((newSessionId: string) => {
    if (newSessionId === currentSessionId) return;

    // Simply update the session ID, the useEffect will handle loading messages
    setCurrentSessionId(newSessionId);
    onSessionChange?.(newSessionId);
  }, [currentSessionId, onSessionChange]);

  const handleDeleteSession = useCallback((deletedSessionId: string) => {
    // If the deleted session is the current one, messages will be cleared by handleNewSession
    console.log('Session deleted:', deletedSessionId);
  }, []);

  const handleCommand = useCallback((command: string) => {
    // Handle built-in commands using the unified command configuration
    const handled = executeBuiltInCommand(command, currentSessionId, addMessage);

    if (!handled) {
      // For other commands, let them be handled by the AI
      console.log('Command not handled locally:', command);
    }
  }, [addMessage, currentSessionId]);

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

  const extraPayload = systemContext ? { system_context: systemContext } : undefined;

  const { sendMessage, stopStreaming } = useChatStreaming({
    sessionId: currentSessionId,
    apiEndpoint,
    currentModel,
    workingDirectory,
    extraPayload,
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
      <ChatHeader
        currentSessionId={currentSessionId}
        onNewSession={handleNewSession}
        onSwitchSession={handleSwitchSession}
        onDeleteSession={handleDeleteSession}
      />
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
        workingDirectory={workingDirectory}
        onWorkingDirectoryChange={setWorkingDirectory}
      />
    </div>
  );
}