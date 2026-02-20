import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type AIProvider = 'anthropic' | 'openai';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIStreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done' | 'usage';
  data: any;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  cost_usd?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// 基础工具定义
export const AVAILABLE_TOOLS: ToolDefinition[] = [
  {
    name: 'get_current_time',
    description: '获取当前时间',
    input_schema: {
      type: 'object',
      properties: {
        timezone: {
          type: 'string',
          description: '时区，如 Asia/Shanghai',
          default: 'Asia/Shanghai',
        },
      },
    },
  },
  {
    name: 'calculate',
    description: '执行数学计算',
    input_schema: {
      type: 'object',
      properties: {
        expression: {
          type: 'string',
          description: '数学表达式，如 "2 + 3 * 4"',
        },
      },
      required: ['expression'],
    },
  },
  {
    name: 'search_web',
    description: '搜索网络信息（模拟）',
    input_schema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
      },
      required: ['query'],
    },
  },
];

class AIClient {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private provider: AIProvider;
  private useLocalCLI: boolean = false;

  constructor() {
    this.provider = (process.env.AI_PROVIDER as AIProvider) || 'anthropic';
    
    // Check if we should use local CLI mode (no API key provided)
    const hasAnthropicKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
    const hasOpenAIKey = process.env.OPENAI_API_KEY;
    
    if (this.provider === 'anthropic') {
      if (hasAnthropicKey) {
        // Use SDK with provided API key
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN,
          baseURL: process.env.ANTHROPIC_BASE_URL,
        });
      } else {
        // Use local CLI mode - will read from ~/.claude/settings.json
        this.useLocalCLI = true;
        console.log('[ai-client] No API key configured, using local CLI mode');
        console.log('[ai-client] Claude CLI will use configuration from ~/.claude/settings.json');
      }
    }
    
    if (this.provider === 'openai' && hasOpenAIKey) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
        baseURL: process.env.OPENAI_BASE_URL,
      });
    }
  }

  async *streamChat(
    messages: AIMessage[],
    model?: string,
    tools: ToolDefinition[] = AVAILABLE_TOOLS
  ): AsyncGenerator<AIStreamChunk> {
    try {
      if (this.provider === 'anthropic') {
        if (this.useLocalCLI) {
          yield* this.streamChatAnthropicCLI(messages, model, tools);
        } else if (this.anthropic) {
          yield* this.streamChatAnthropic(messages, model, tools);
        } else {
          throw new Error('Anthropic provider not configured');
        }
      } else if (this.provider === 'openai' && this.openai) {
        yield* this.streamChatOpenAI(messages, model, tools);
      } else {
        throw new Error(`AI provider ${this.provider} not configured`);
      }
    } catch (error) {
      yield {
        type: 'error',
        data: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async *streamChatAnthropic(
    messages: AIMessage[],
    model?: string,
    tools: ToolDefinition[] = []
  ): AsyncGenerator<AIStreamChunk> {
    if (!this.anthropic) throw new Error('Anthropic client not initialized');

    const stream = await this.anthropic.messages.stream({
      model: model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      system: messages.find(m => m.role === 'system')?.content,
      tools: tools.length > 0 ? tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })) : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield {
          type: 'text',
          data: chunk.delta.text,
        };
      } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
        yield {
          type: 'tool_use',
          data: {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            input: chunk.content_block.input,
          },
        };
      } else if (chunk.type === 'message_stop') {
        // 获取最终的使用统计
        const finalMessage = await stream.finalMessage();
        if (finalMessage.usage) {
          const usage: TokenUsage = {
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
            cache_read_input_tokens: (finalMessage.usage as any).cache_read_input_tokens,
            cache_creation_input_tokens: (finalMessage.usage as any).cache_creation_input_tokens,
          };
          
          // 计算成本（Anthropic 定价）
          const inputCost = usage.input_tokens * 0.000003; // $3 per 1M input tokens
          const outputCost = usage.output_tokens * 0.000015; // $15 per 1M output tokens
          const cacheCost = (usage.cache_read_input_tokens || 0) * 0.0000003; // $0.3 per 1M cache read tokens
          usage.cost_usd = inputCost + outputCost + cacheCost;

          yield {
            type: 'usage',
            data: usage,
          };
        }
      }
    }

    yield { type: 'done', data: null };
  }

  private async *streamChatAnthropicCLI(
    messages: AIMessage[],
    model?: string,
    tools: ToolDefinition[] = []
  ): AsyncGenerator<AIStreamChunk> {
    // 本地 CLI 模式：从环境变量或 ~/.claude/settings.json 读取配置
    let apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
    let baseURL = process.env.ANTHROPIC_BASE_URL;
    
    // 如果环境变量中没有 API key，尝试从本地配置文件读取
    if (!apiKey && typeof window === 'undefined') {
      try {
        const os = await import('os');
        const fs = await import('fs');
        const path = await import('path');
        
        const settingsPath = path.join(os.homedir(), '.claude', 'settings.json');
        console.log('[ai-client] Attempting to read config from:', settingsPath);
        
        if (fs.existsSync(settingsPath)) {
          const settingsContent = fs.readFileSync(settingsPath, 'utf-8');
          const settings = JSON.parse(settingsContent);
          
          // 支持两种配置格式：
          // 1. 直接在根级别：{ "api_key": "...", "base_url": "..." }
          // 2. 在 env 对象中：{ "env": { "ANTHROPIC_AUTH_TOKEN": "...", "ANTHROPIC_BASE_URL": "..." } }
          
          let configApiKey = settings.api_key || settings.auth_token;
          let configBaseUrl = settings.base_url;
          
          // 如果根级别没有，检查 env 对象
          if (!configApiKey && settings.env) {
            configApiKey = settings.env.ANTHROPIC_API_KEY || settings.env.ANTHROPIC_AUTH_TOKEN;
            configBaseUrl = settings.env.ANTHROPIC_BASE_URL;
          }
          
          console.log('[ai-client] Config file found, keys present:', {
            hasApiKey: !!configApiKey,
            hasBaseUrl: !!configBaseUrl,
            configFormat: settings.env ? 'env object' : 'root level'
          });
          
          if (configApiKey) {
            apiKey = configApiKey;
            baseURL = configBaseUrl || baseURL;
            console.log('[ai-client] Successfully loaded API key from local config');
          }
        } else {
          console.log('[ai-client] Config file not found at:', settingsPath);
        }
      } catch (error) {
        console.error('[ai-client] Failed to read local CLI config:', error);
        // 继续执行，让后面的错误处理来处理
      }
    }
    
    // 如果仍然没有 API key，返回友好的错误信息
    if (!apiKey) {
      const errorMessage = `❌ Anthropic API key not configured

Please configure your API key using one of these methods:

1. **Environment Variables** (Recommended for production):
   - Set ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN
   - Example: export ANTHROPIC_API_KEY="sk-ant-..."

2. **Local Config File** (For development):
   - Create ~/.claude/settings.json with:
     {
       "api_key": "sk-ant-...",
       "base_url": "https://api.anthropic.com" (optional)
     }

3. **Next.js Environment File**:
   - Add to .env.local:
     ANTHROPIC_API_KEY=sk-ant-...

Current status:
- Environment variables: ${process.env.ANTHROPIC_API_KEY ? '✓ Found' : '✗ Not set'}
- Local config: ${typeof window === 'undefined' ? 'Checked (not found or invalid)' : 'Skipped (browser environment)'}`;

      throw new Error(errorMessage);
    }
    
    // 创建临时客户端并调用
    console.log('[ai-client] Creating Anthropic client with local CLI config');
    const tempClient = new Anthropic({
      apiKey,
      baseURL,
    });
    
    yield* this.streamWithClient(tempClient, messages, model, tools);
  }

  private async *streamWithClient(
    client: Anthropic,
    messages: AIMessage[],
    model?: string,
    tools: ToolDefinition[] = []
  ): AsyncGenerator<AIStreamChunk> {
    const stream = await client.messages.stream({
      model: model || process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022',
      max_tokens: 4000,
      messages: messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      system: messages.find(m => m.role === 'system')?.content,
      tools: tools.length > 0 ? tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.input_schema,
      })) : undefined,
    });

    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        yield {
          type: 'text',
          data: chunk.delta.text,
        };
      } else if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
        yield {
          type: 'tool_use',
          data: {
            id: chunk.content_block.id,
            name: chunk.content_block.name,
            input: chunk.content_block.input,
          },
        };
      } else if (chunk.type === 'message_stop') {
        const finalMessage = await stream.finalMessage();
        if (finalMessage.usage) {
          const usage: TokenUsage = {
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
            cache_read_input_tokens: (finalMessage.usage as any).cache_read_input_tokens,
            cache_creation_input_tokens: (finalMessage.usage as any).cache_creation_input_tokens,
          };
          
          const inputCost = usage.input_tokens * 0.000003;
          const outputCost = usage.output_tokens * 0.000015;
          const cacheCost = (usage.cache_read_input_tokens || 0) * 0.0000003;
          usage.cost_usd = inputCost + outputCost + cacheCost;

          yield {
            type: 'usage',
            data: usage,
          };
        }
      }
    }

    yield { type: 'done', data: null };
  }

  private async *streamChatOpenAI(
    messages: AIMessage[],
    model?: string,
    tools: ToolDefinition[] = []
  ): AsyncGenerator<AIStreamChunk> {
    if (!this.openai) throw new Error('OpenAI client not initialized');

    const stream = await this.openai.chat.completions.create({
      model: model || process.env.OPENAI_MODEL || 'gpt-4o',
      messages: messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      stream: true,
      tools: tools.length > 0 ? tools.map(tool => ({
        type: 'function',
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.input_schema,
        },
      })) : undefined,
      stream_options: { include_usage: true },
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta;
      
      if (delta?.content) {
        yield {
          type: 'text',
          data: delta.content,
        };
      }
      
      if (delta?.tool_calls) {
        for (const toolCall of delta.tool_calls) {
          if (toolCall.function) {
            yield {
              type: 'tool_use',
              data: {
                id: toolCall.id,
                name: toolCall.function.name,
                input: JSON.parse(toolCall.function.arguments || '{}'),
              },
            };
          }
        }
      }

      // 处理使用统计
      if (chunk.usage) {
        const usage: TokenUsage = {
          input_tokens: chunk.usage.prompt_tokens,
          output_tokens: chunk.usage.completion_tokens,
        };

        // 计算成本（OpenAI 定价，以 GPT-4o 为例）
        const inputCost = usage.input_tokens * 0.0000025; // $2.5 per 1M input tokens
        const outputCost = usage.output_tokens * 0.00001; // $10 per 1M output tokens
        usage.cost_usd = inputCost + outputCost;

        yield {
          type: 'usage',
          data: usage,
        };
      }
    }

    yield { type: 'done', data: null };
  }
}

export const aiClient = new AIClient();