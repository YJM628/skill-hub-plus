/** Chat message */
export interface Message {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  token_usage?: string | null;
}

/** Token usage statistics */
export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cost_usd?: number | null;
}

/** File attachment */
export interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  data: string;
  filePath?: string;
}

/** Permission request event from AI tool use */
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

/** Tool use info during streaming */
export interface ToolUseInfo {
  id: string;
  name: string;
  input: unknown;
}

/** Tool result info during streaming */
export interface ToolResultInfo {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** Chat panel configuration */
export interface ChatPanelConfig {
  /** API endpoint for sending messages (default: '/api/chat') */
  apiEndpoint?: string;
  /** Title shown in empty state */
  title?: string;
  /** Description shown in empty state */
  description?: string;
  /** Custom empty state icon */
  emptyStateIcon?: React.ReactNode;
  /** Placeholder text for input */
  placeholder?: string;
  /** Available model options */
  models?: Array<{ value: string; label: string }>;
  /** Default model */
  defaultModel?: string;
  /** Available suggestions */
  suggestions?: Array<{ value: string; label: string; description?: string; icon?: any }>;
}
