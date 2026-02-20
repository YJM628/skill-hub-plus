
import { useState, useEffect, useRef } from 'react';
import {
  Message as AIMessage,
  MessageContent,
  MessageResponse,
} from '@/chat-panel-core/components/ai-elements/message';
import { ToolActionsGroup } from '@/chat-panel-core/components/ai-elements/tool-actions-group';
import {
  Confirmation,
  ConfirmationTitle,
  ConfirmationRequest,
  ConfirmationAccepted,
  ConfirmationRejected,
  ConfirmationActions,
  ConfirmationAction,
} from '@/chat-panel-core/components/ai-elements/confirmation';
import { Shimmer } from '@/chat-panel-core/components/ai-elements/shimmer';
import type { ToolUseInfo, ToolResultInfo, PermissionRequestEvent } from '@/chat-panel-core/types';

type ToolState =
  | 'input-streaming'
  | 'input-available'
  | 'approval-requested'
  | 'approval-responded'
  | 'output-denied'
  | 'output-available';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  toolUses?: ToolUseInfo[];
  toolResults?: ToolResultInfo[];
  streamingToolOutput?: string;
  statusText?: string;
  pendingPermission?: PermissionRequestEvent | null;
  onPermissionResponse?: (decision: 'allow' | 'allow_session' | 'deny') => void;
  permissionResolved?: 'allow' | 'deny' | null;
}

function ElapsedTimer() {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;

  return (
    <span className="tabular-nums">
      {mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
    </span>
  );
}

function StreamingStatusBar({ statusText }: { statusText?: string }) {
  const displayText = statusText || 'Thinking';
  return (
    <div className="flex items-center gap-3 py-2 px-1 text-xs text-muted-foreground">
      <div className="flex items-center gap-2">
        <Shimmer duration={1.5}>{displayText}</Shimmer>
      </div>
      <span className="text-muted-foreground/50">|</span>
      <ElapsedTimer />
    </div>
  );
}

export function StreamingMessage({
  content,
  isStreaming,
  toolUses = [],
  toolResults = [],
  streamingToolOutput,
  statusText,
  pendingPermission,
  onPermissionResponse,
  permissionResolved,
}: StreamingMessageProps) {
  const runningTools = toolUses.filter(
    (tool) => !toolResults.some((r) => r.tool_use_id === tool.id)
  );

  const getConfirmationState = (): ToolState => {
    if (permissionResolved) return 'approval-responded';
    if (pendingPermission) return 'approval-requested';
    return 'input-available';
  };

  const getApproval = () => {
    if (!pendingPermission && !permissionResolved) return undefined;
    if (permissionResolved === 'allow') {
      return { id: pendingPermission?.permissionRequestId || '', approved: true as const };
    }
    if (permissionResolved === 'deny') {
      return { id: pendingPermission?.permissionRequestId || '', approved: false as const };
    }
    return { id: pendingPermission?.permissionRequestId || '' };
  };

  const formatToolInput = (input: Record<string, unknown>): string => {
    if (input.command) return String(input.command);
    if (input.file_path) return String(input.file_path);
    if (input.path) return String(input.path);
    return JSON.stringify(input, null, 2);
  };

  const getRunningCommandSummary = (): string | undefined => {
    if (runningTools.length === 0) return undefined;
    const tool = runningTools[runningTools.length - 1];
    const input = tool.input as Record<string, unknown>;
    if (tool.name === 'Bash' && input.command) {
      const cmd = String(input.command);
      return cmd.length > 80 ? cmd.slice(0, 80) + '...' : cmd;
    }
    if (input.file_path) return `${tool.name}: ${String(input.file_path)}`;
    if (input.path) return `${tool.name}: ${String(input.path)}`;
    return `Running ${tool.name}...`;
  };

  return (
    <AIMessage from="assistant">
      <MessageContent>
        {toolUses.length > 0 && (
          <ToolActionsGroup
            tools={toolUses.map((tool) => {
              const result = toolResults.find((r) => r.tool_use_id === tool.id);
              return {
                id: tool.id, name: tool.name, input: tool.input,
                result: result?.content, isError: result?.is_error,
              };
            })}
            isStreaming={isStreaming}
            streamingToolOutput={streamingToolOutput}
          />
        )}

        {(pendingPermission || permissionResolved) && (
          <Confirmation approval={getApproval()} state={getConfirmationState()}>
            <ConfirmationTitle>
              <span className="font-medium">{pendingPermission?.toolName}</span>
              {pendingPermission?.decisionReason && (
                <span className="text-muted-foreground ml-2">— {pendingPermission.decisionReason}</span>
              )}
            </ConfirmationTitle>
            {pendingPermission && (
              <div className="mt-1 rounded bg-muted/50 px-3 py-2 font-mono text-xs">
                {formatToolInput(pendingPermission.toolInput)}
              </div>
            )}
            <ConfirmationRequest>
              <ConfirmationActions>
                <ConfirmationAction variant="outline" onClick={() => onPermissionResponse?.('deny')}>Deny</ConfirmationAction>
                <ConfirmationAction variant="outline" onClick={() => onPermissionResponse?.('allow')}>Allow Once</ConfirmationAction>
                {pendingPermission?.suggestions && pendingPermission.suggestions.length > 0 && (
                  <ConfirmationAction variant="default" onClick={() => onPermissionResponse?.('allow_session')}>Allow for Session</ConfirmationAction>
                )}
              </ConfirmationActions>
            </ConfirmationRequest>
            <ConfirmationAccepted><p className="text-xs text-green-600 dark:text-green-400">Allowed</p></ConfirmationAccepted>
            <ConfirmationRejected><p className="text-xs text-red-600 dark:text-red-400">Denied</p></ConfirmationRejected>
          </Confirmation>
        )}

        {content && <MessageResponse>{content}</MessageResponse>}

        {isStreaming && !content && toolUses.length === 0 && !pendingPermission && (
          <div className="py-2"><Shimmer>Thinking...</Shimmer></div>
        )}

        {isStreaming && !pendingPermission && (
          <StreamingStatusBar statusText={statusText || getRunningCommandSummary()} />
        )}
      </MessageContent>
    </AIMessage>
  );
}
