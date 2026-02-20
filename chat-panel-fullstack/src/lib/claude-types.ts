/**
 * Type definitions for Claude client
 */

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cost_usd?: number;
}

export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string; // base64 encoded
  filePath?: string;
}

export interface PermissionRequestEvent {
  permissionRequestId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  suggestions?: Array<{ allow: boolean; reason?: string }>;
  decisionReason?: string;
  blockedPath?: string;
  toolUseId?: string;
  description?: string;
}

export interface MCPServerConfig {
  type?: 'stdio' | 'sse' | 'http';
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface SSEEvent {
  type: string;
  data: string;
}

export interface ClaudeStreamOptions {
  prompt: string;
  sdkSessionId?: string;
  model?: string;
  systemPrompt?: string;
  workingDirectory?: string;
  mcpServers?: Record<string, MCPServerConfig>;
  abortController?: AbortController;
  permissionMode?: 'acceptEdits' | 'acceptAll' | 'bypassPermissions';
  files?: FileAttachment[];
}

/**
 * Check if a MIME type represents an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith('image/');
}
