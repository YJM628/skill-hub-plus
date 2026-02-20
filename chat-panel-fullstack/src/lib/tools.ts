import { ToolDefinition } from './ai-client';

export interface ToolExecutionResult {
  success: boolean;
  content: string;
  is_error?: boolean;
}

export class ToolExecutor {
  async executeToolCall(
    toolName: string,
    toolInput: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    try {
      switch (toolName) {
        case 'get_current_time':
          return this.getCurrentTime(toolInput);
        case 'calculate':
          return this.calculate(toolInput);
        case 'search_web':
          return this.searchWeb(toolInput);
        default:
          return {
            success: false,
            content: `Unknown tool: ${toolName}`,
            is_error: true,
          };
      }
    } catch (error) {
      return {
        success: false,
        content: `Tool execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        is_error: true,
      };
    }
  }

  private getCurrentTime(input: Record<string, unknown>): ToolExecutionResult {
    const timezone = (input.timezone as string) || 'Asia/Shanghai';
    
    try {
      const now = new Date();
      const timeString = now.toLocaleString('zh-CN', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        weekday: 'long',
      });
      
      return {
        success: true,
        content: `当前时间（${timezone}）：${timeString}`,
      };
    } catch (error) {
      return {
        success: false,
        content: `无效的时区: ${timezone}`,
        is_error: true,
      };
    }
  }

  private calculate(input: Record<string, unknown>): ToolExecutionResult {
    const expression = input.expression as string;
    
    if (!expression) {
      return {
        success: false,
        content: '缺少表达式参数',
        is_error: true,
      };
    }

    try {
      // 简单的数学表达式计算（生产环境应使用更安全的解析器）
      const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
      if (sanitized !== expression) {
        return {
          success: false,
          content: '表达式包含不允许的字符',
          is_error: true,
        };
      }

      const result = Function(`"use strict"; return (${sanitized})`)();
      
      return {
        success: true,
        content: `计算结果：${expression} = ${result}`,
      };
    } catch (error) {
      return {
        success: false,
        content: `计算错误：${error instanceof Error ? error.message : '无效的表达式'}`,
        is_error: true,
      };
    }
  }

  private searchWeb(input: Record<string, unknown>): ToolExecutionResult {
    const query = input.query as string;
    
    if (!query) {
      return {
        success: false,
        content: '缺少搜索关键词',
        is_error: true,
      };
    }

    // 模拟搜索结果
    const mockResults = [
      `关于 "${query}" 的搜索结果：`,
      '',
      '1. 这是一个模拟的搜索结果示例',
      '2. 实际应用中，这里会调用真实的搜索 API',
      '3. 可以集成 Google Search API、Bing API 等',
      '',
      `搜索关键词：${query}`,
      `搜索时间：${new Date().toLocaleString('zh-CN')}`,
    ].join('\n');

    return {
      success: true,
      content: mockResults,
    };
  }

  // 检查工具是否需要权限确认
  requiresPermission(toolName: string): boolean {
    const permissionRequiredTools = ['search_web']; // 可配置需要权限的工具
    return permissionRequiredTools.includes(toolName);
  }

  // 获取工具的风险级别描述
  getToolRiskDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      get_current_time: '获取系统时间，无风险',
      calculate: '执行数学计算，低风险',
      search_web: '搜索网络信息，可能访问外部服务',
    };
    return descriptions[toolName] || '未知工具';
  }
}

export const toolExecutor = new ToolExecutor();