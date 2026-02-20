
import { useCallback, useRef, useEffect } from 'react';
import type { Message, ToolUseInfo, ToolResultInfo, PermissionRequestEvent, FileAttachment } from '@/chat-panel-core/types';

interface UseChatStreamingProps {
  sessionId: string;
  apiEndpoint?: string;
  currentModel?: string;
  workingDirectory?: string;
  extraPayload?: Record<string, unknown>;
  onStreamingStateChange: (isStreaming: boolean) => void;
  onStreamingContentChange: (content: string) => void;
  onToolUsesChange: (tools: ToolUseInfo[] | ((prev: ToolUseInfo[]) => ToolUseInfo[])) => void;
  onToolResultsChange: (results: ToolResultInfo[] | ((prev: ToolResultInfo[]) => ToolResultInfo[])) => void;
  onStreamingToolOutputChange: (output: string | ((prev: string) => string)) => void;
  onStatusTextChange: (text: string | undefined) => void;
  onMessageAdd: (message: Message) => void;
  onPendingPermissionChange: (permission: PermissionRequestEvent | null) => void;
  onPermissionResolvedChange: (resolved: 'allow' | 'deny' | null) => void;
  isStreaming: boolean;
}

export function useChatStreaming({
  sessionId,
  apiEndpoint = '/api/chat',
  currentModel,
  workingDirectory,
  extraPayload,
  onStreamingStateChange,
  onStreamingContentChange,
  onToolUsesChange,
  onToolResultsChange,
  onStreamingToolOutputChange,
  onStatusTextChange,
  onMessageAdd,
  onPendingPermissionChange,
  onPermissionResolvedChange,
  isStreaming,
}: UseChatStreamingProps) {
  const abortControllerRef = useRef<AbortController | null>(null);
  const accumulatedRef = useRef('');

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && accumulatedRef.current) {
        onStreamingContentChange(accumulatedRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [onStreamingContentChange]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }, []);

  const resetStreamingState = useCallback(() => {
    onStreamingStateChange(false);
    onStreamingContentChange('');
    accumulatedRef.current = '';
    onToolUsesChange([]);
    onToolResultsChange([]);
    onStreamingToolOutputChange('');
    onStatusTextChange(undefined);
    onPendingPermissionChange(null);
    onPermissionResolvedChange(null);
    abortControllerRef.current = null;
  }, [
    onStreamingStateChange,
    onStreamingContentChange,
    onToolUsesChange,
    onToolResultsChange,
    onStreamingToolOutputChange,
    onStatusTextChange,
    onPendingPermissionChange,
    onPermissionResolvedChange,
  ]);

  const sendMessage = useCallback(
    async (content: string, files?: FileAttachment[]) => {
      if (isStreaming) return;

      let displayContent = content;
      if (files && files.length > 0) {
        const fileMeta = files.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size, data: f.data }));
        displayContent = `<!--files:${JSON.stringify(fileMeta)}-->${content}`;
      }

      const userMessage: Message = {
        id: 'temp-' + Date.now(),
        session_id: sessionId,
        role: 'user',
        content: displayContent,
        created_at: new Date().toISOString(),
        token_usage: null,
      };
      onMessageAdd(userMessage);
      onStreamingStateChange(true);
      onStreamingContentChange('');
      accumulatedRef.current = '';
      onToolUsesChange([]);
      onToolResultsChange([]);
      onStatusTextChange(undefined);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      let accumulated = '';

      try {
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            session_id: sessionId,
            content,
            model: currentModel,
            working_directory: workingDirectory,
            ...(files && files.length > 0 ? { files } : {}),
            ...extraPayload,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to send message');
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response stream');

        const decoder = new TextDecoder();
        let tokenUsage: unknown = null;
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            try {
              const event = JSON.parse(line.slice(6));

              switch (event.type) {
                case 'text': {
                  accumulated += event.data;
                  accumulatedRef.current = accumulated;
                  onStreamingContentChange(accumulated);
                  break;
                }
                case 'tool_use': {
                  try {
                    const toolData = JSON.parse(event.data);
                    onStreamingToolOutputChange('');
                    onToolUsesChange((prev: ToolUseInfo[]) => {
                      if (prev.some((t) => t.id === toolData.id)) return prev;
                      return [...prev, { id: toolData.id, name: toolData.name, input: toolData.input }];
                    });
                  } catch { /* skip */ }
                  break;
                }
                case 'tool_result': {
                  try {
                    const resultData = JSON.parse(event.data);
                    onStreamingToolOutputChange('');
                    onToolResultsChange((prev: ToolResultInfo[]) => [...prev, {
                      tool_use_id: resultData.tool_use_id,
                      content: resultData.content,
                    }]);
                  } catch { /* skip */ }
                  break;
                }
                case 'tool_output': {
                  try {
                    const parsed = JSON.parse(event.data);
                    if (parsed._progress) {
                      onStatusTextChange(`Running ${parsed.tool_name}... (${Math.round(parsed.elapsed_time_seconds)}s)`);
                      break;
                    }
                  } catch { /* Not JSON — raw stderr output */ }
                  onStreamingToolOutputChange((prev: string) => {
                    const next = prev + (prev ? '\n' : '') + event.data;
                    return next.length > 5000 ? next.slice(-5000) : next;
                  });
                  break;
                }
                case 'status': {
                  try {
                    const statusData = JSON.parse(event.data);
                    if (statusData.session_id) {
                      onStatusTextChange(`Connected (${statusData.model || 'ai'})`);
                      setTimeout(() => onStatusTextChange(undefined), 2000);
                    } else if (statusData.notification) {
                      onStatusTextChange(statusData.message || statusData.title || undefined);
                    } else {
                      onStatusTextChange(typeof event.data === 'string' ? event.data : undefined);
                    }
                  } catch {
                    onStatusTextChange(event.data || undefined);
                  }
                  break;
                }
                case 'result': {
                  try {
                    const resultData = JSON.parse(event.data);
                    if (resultData.usage) tokenUsage = resultData.usage;
                  } catch { /* skip */ }
                  onStatusTextChange(undefined);
                  break;
                }
                case 'permission_request': {
                  try {
                    const permData = JSON.parse(event.data);
                    onPendingPermissionChange(permData);
                    onPermissionResolvedChange(null);
                  } catch { /* skip */ }
                  break;
                }
                case 'error': {
                  accumulated += '\n\n**Error:** ' + event.data;
                  accumulatedRef.current = accumulated;
                  onStreamingContentChange(accumulated);
                  break;
                }
                case 'done': break;
              }
            } catch { /* skip malformed SSE lines */ }
          }
        }

        if (accumulated.trim()) {
          const assistantMessage: Message = {
            id: 'temp-assistant-' + Date.now(),
            session_id: sessionId,
            role: 'assistant',
            content: accumulated.trim(),
            created_at: new Date().toISOString(),
            token_usage: tokenUsage ? JSON.stringify(tokenUsage) : null,
          };
          onMessageAdd(assistantMessage);
        }
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') {
          if (accumulated.trim()) {
            onMessageAdd({
              id: 'temp-assistant-' + Date.now(),
              session_id: sessionId,
              role: 'assistant',
              content: accumulated.trim() + '\n\n*(generation stopped)*',
              created_at: new Date().toISOString(),
              token_usage: null,
            });
          }
        } else {
          const errMsg = error instanceof Error ? error.message : 'Unknown error';
          onMessageAdd({
            id: 'temp-error-' + Date.now(),
            session_id: sessionId,
            role: 'assistant',
            content: `**Error:** ${errMsg}`,
            created_at: new Date().toISOString(),
            token_usage: null,
          });
        }
      } finally {
        resetStreamingState();
      }
    },
    [
      sessionId, isStreaming, apiEndpoint, currentModel, extraPayload,
      onMessageAdd, onStreamingStateChange, onStreamingContentChange,
      onToolUsesChange, onToolResultsChange, onStreamingToolOutputChange,
      onStatusTextChange, onPendingPermissionChange, onPermissionResolvedChange,
      resetStreamingState,
    ]
  );

  return { sendMessage, stopStreaming };
}
