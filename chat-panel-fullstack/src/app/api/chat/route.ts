import { NextRequest } from 'next/server';
import { streamClaude } from '@/lib/claude-client';
import { resolvePendingPermission } from '@/lib/permission-registry';
import { sessionStore } from '@/lib/session-store';
import type { FileAttachment } from '@/lib/claude-types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { session_id, content, model, files, system_context, working_directory } = body;

    if (!session_id || !content) {
      return new Response(
        JSON.stringify({ error: 'Missing session_id or content' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // 添加用户消息到会话
    sessionStore.addMessage(session_id, {
      role: 'user',
      content,
      token_usage: null,
    });

    // 获取会话历史
    const messages = sessionStore.getMessages(session_id);
    const session = sessionStore.getSession(session_id);

    // 转换文件附件格式
    const fileAttachments: FileAttachment[] | undefined = files && files.length > 0
      ? files.map((f: any, i: number) => ({
          id: f.id || `file-${Date.now()}-${i}`,
          name: f.name,
          type: f.type,
          size: f.size || 0,
          data: f.data,
          filePath: f.filePath,
        }))
      : undefined;

    // 创建 AbortController 用于中断请求
    const abortController = new AbortController();
    request.signal.addEventListener('abort', () => {
      abortController.abort();
    });

    // 调用 streamClaude 获取流式响应
    const claudeStream = streamClaude({
      prompt: content,
      sdkSessionId: session?.sdk_session_id || undefined,
      model: model || 'claude-3-5-sonnet-20241022',
      systemPrompt: system_context || undefined,
      workingDirectory: working_directory || process.cwd(),
      abortController,
      files: fileAttachments,
      permissionMode: 'acceptEdits',
    });

    // 包装流以捕获并保存 SDK session_id，同时透传 SSE 数据
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = claudeStream.getReader();
        let sdkSessionIdSaved = false;
        let closed = false;

        const safeEnqueue = (chunk: string) => {
          if (closed) return;
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            closed = true;
          }
        };

        const safeClose = () => {
          if (closed) return;
          closed = true;
          try {
            controller.close();
          } catch {
            // controller already closed by client disconnect
          }
        };

        try {
          while (true) {
            if (closed) break;
            const { done, value } = await reader.read();
            if (done) break;

            // 尝试从 SSE 数据中提取 session_id
            if (!sdkSessionIdSaved && value.includes('"type":"status"')) {
              try {
                const match = value.match(/data:\s*(\{.*\})/);
                if (match) {
                  const data = JSON.parse(match[1]);
                  if (data.type === 'status') {
                    const statusData = JSON.parse(data.data);
                    if (statusData.session_id) {
                      sessionStore.updateSdkSessionId(session_id, statusData.session_id);
                      sdkSessionIdSaved = true;
                    }
                  }
                }
              } catch {
                // 忽略解析错误
              }
            }

            // 直接透传 SSE 字符串数据
            safeEnqueue(value);
          }
          safeClose();
        } catch (error) {
          if (!closed) {
            closed = true;
            try {
              controller.error(error);
            } catch {
              // controller already closed
            }
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  }
}