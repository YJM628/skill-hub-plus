'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { Message, TokenUsage } from '@/chat-panel-core/types';
import {
  Message as AIMessage,
  MessageContent,
  MessageResponse,
} from '@/chat-panel-core/components/ai-elements/message';
import { ToolActionsGroup } from '@/chat-panel-core/components/ai-elements/tool-actions-group';
import { CopyIcon, CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react';

interface ToolBlock {
  type: 'tool_use' | 'tool_result';
  id?: string;
  name?: string;
  input?: unknown;
  content?: string;
  is_error?: boolean;
}

function parseToolBlocks(content: string): { text: string; tools: ToolBlock[] } {
  const tools: ToolBlock[] = [];
  let text = '';

  if (content.startsWith('[')) {
    try {
      const blocks = JSON.parse(content) as Array<{
        type: string; text?: string; id?: string; name?: string;
        input?: unknown; tool_use_id?: string; content?: string; is_error?: boolean;
      }>;
      for (const block of blocks) {
        if (block.type === 'text' && block.text) {
          text += block.text;
        } else if (block.type === 'tool_use') {
          tools.push({ type: 'tool_use', id: block.id, name: block.name, input: block.input });
        } else if (block.type === 'tool_result') {
          tools.push({ type: 'tool_result', id: block.tool_use_id, content: block.content, is_error: block.is_error });
        }
      }
      return { text: text.trim(), tools };
    } catch { /* fall through */ }
  }

  text = content;
  const toolUseRegex = /<!--tool_use:([\s\S]*?)-->/g;
  let match;
  while ((match = toolUseRegex.exec(content)) !== null) {
    try { tools.push({ type: 'tool_use', ...JSON.parse(match[1]) }); } catch { /* skip */ }
    text = text.replace(match[0], '');
  }
  const toolResultRegex = /<!--tool_result:([\s\S]*?)-->/g;
  while ((match = toolResultRegex.exec(content)) !== null) {
    try { tools.push({ type: 'tool_result', ...JSON.parse(match[1]) }); } catch { /* skip */ }
    text = text.replace(match[0], '');
  }
  return { text: text.trim(), tools };
}

function pairTools(tools: ToolBlock[]) {
  const paired: Array<{ name: string; input: unknown; result?: string; isError?: boolean }> = [];
  const resultMap = new Map<string, ToolBlock>();
  for (const t of tools) {
    if (t.type === 'tool_result' && t.id) resultMap.set(t.id, t);
  }
  for (const t of tools) {
    if (t.type === 'tool_use' && t.name) {
      const result = t.id ? resultMap.get(t.id) : undefined;
      paired.push({ name: t.name, input: t.input, result: result?.content, isError: result?.is_error });
    }
  }
  for (const t of tools) {
    if (t.type === 'tool_result' && !tools.some(u => u.type === 'tool_use' && u.id === t.id)) {
      paired.push({ name: 'tool_result', input: {}, result: t.content, isError: t.is_error });
    }
  }
  return paired;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted transition-colors"
      title="Copy"
    >
      {copied ? <CheckIcon className="h-3 w-3 text-green-500" /> : <CopyIcon className="h-3 w-3" />}
    </button>
  );
}

function TokenUsageDisplay({ usage }: { usage: TokenUsage }) {
  const totalTokens = usage.input_tokens + usage.output_tokens;
  const costStr = usage.cost_usd !== undefined && usage.cost_usd !== null
    ? ` · $${usage.cost_usd.toFixed(4)}`
    : '';

  return (
    <span className="group/tokens relative cursor-default text-xs text-muted-foreground/50">
      <span>{totalTokens.toLocaleString()} tokens{costStr}</span>
      <span className="pointer-events-none absolute bottom-full left-0 mb-1.5 whitespace-nowrap rounded-md bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-md border border-border/50 opacity-0 group-hover/tokens:opacity-100 transition-opacity duration-150 z-50">
        In: {usage.input_tokens.toLocaleString()} · Out: {usage.output_tokens.toLocaleString()}
        {usage.cache_read_input_tokens ? ` · Cache: ${usage.cache_read_input_tokens.toLocaleString()}` : ''}
        {costStr}
      </span>
    </span>
  );
}

const COLLAPSE_HEIGHT = 300;

export function MessageItem({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const { text, tools } = parseToolBlocks(message.content);
  const pairedTools = pairTools(tools);
  const displayText = text;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isUser && contentRef.current) {
      setIsOverflowing(contentRef.current.scrollHeight > COLLAPSE_HEIGHT);
    }
  }, [isUser, displayText]);

  let tokenUsage: TokenUsage | null = null;
  if (message.token_usage) {
    try { tokenUsage = JSON.parse(message.token_usage); } catch { /* skip */ }
  }

  const timestamp = new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <AIMessage from={isUser ? 'user' : 'assistant'}>
      <MessageContent>
        {!isUser && pairedTools.length > 0 && (
          <ToolActionsGroup
            tools={pairedTools.map((tool, i) => ({
              id: `hist-${i}`, name: tool.name, input: tool.input,
              result: tool.result, isError: tool.isError,
            }))}
          />
        )}
        {displayText && (
          isUser ? (
            <div className="relative">
              <div
                ref={contentRef}
                className="text-sm whitespace-pre-wrap break-words transition-[max-height] duration-300 ease-in-out overflow-hidden"
                style={isOverflowing && !isExpanded ? { maxHeight: `${COLLAPSE_HEIGHT}px` } : undefined}
              >
                {displayText}
              </div>
              {isOverflowing && !isExpanded && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-secondary to-transparent pointer-events-none" />
              )}
              {isOverflowing && (
                <button
                  type="button"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="relative z-10 flex items-center gap-1 mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isExpanded ? (<><ChevronUpIcon className="h-3 w-3" /><span>Collapse</span></>) : (<><ChevronDownIcon className="h-3 w-3" /><span>Expand</span></>)}
                </button>
              )}
            </div>
          ) : (
            <MessageResponse>{displayText}</MessageResponse>
          )
        )}
      </MessageContent>
      <div className={`flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isUser ? 'justify-end' : ''}`}>
        {!isUser && <span className="text-xs text-muted-foreground/50">{timestamp}</span>}
        {!isUser && tokenUsage && <TokenUsageDisplay usage={tokenUsage} />}
        {displayText && <CopyButton text={displayText} />}
      </div>
    </AIMessage>
  );
}
