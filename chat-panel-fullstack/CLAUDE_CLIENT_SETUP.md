# Claude Client 集成指南

本文档说明如何在 chat-panel-fullstack 项目中使用 Claude Agent SDK 客户端，以获得完整的 MCP 服务器和 Skills 支持。

## 功能特性

✅ **MCP 服务器支持** - 支持 stdio、SSE 和 HTTP 三种传输协议  
✅ **Skills 系统** - 自动加载用户在 `~/.claude/` 中配置的 skills  
✅ **权限管理** - 完整的工具调用权限请求和处理机制  
✅ **文件附件** - 支持图片（vision）和文档附件  
✅ **会话恢复** - 支持跨请求的会话状态管理  
✅ **流式响应** - SSE 格式的实时流式输出

## 已安装的依赖

```json
{
  "@anthropic-ai/claude-agent-sdk": "^0.2.44"
}
```

## 文件结构

```
src/lib/
├── claude-client.ts        # 主客户端（从主项目复制并适配）
├── claude-types.ts         # 类型定义
├── permission-registry.ts  # 权限管理
├── platform.ts            # 平台相关工具（Claude CLI 查找等）
└── config-helper.ts       # 配置读取（简化版，从环境变量读取）
```

## 环境变量配置

在 `.env.local` 文件中配置：

```bash
# Anthropic API 配置
ANTHROPIC_API_KEY=your_api_key_here
# 或者使用
ANTHROPIC_AUTH_TOKEN=your_auth_token_here

# 可选：自定义 API 端点
ANTHROPIC_BASE_URL=https://api.anthropic.com

# 可选：跳过权限确认（危险，仅用于开发）
DANGEROUSLY_SKIP_PERMISSIONS=false
```

## 使用方法

### 1. 基本使用

```typescript
import { streamClaude } from '@/lib/claude-client';

// 创建流式响应
const stream = streamClaude({
  prompt: '用户的问题',
  workingDirectory: process.cwd(),
  model: 'claude-3-5-sonnet-20241022',
});

// 处理 SSE 流
for await (const chunk of stream) {
  const line = new TextDecoder().decode(chunk);
  if (line.startsWith('data: ')) {
    const data = JSON.parse(line.slice(6));
    
    switch (data.type) {
      case 'text':
        console.log('文本:', data.data);
        break;
      case 'tool_use':
        console.log('工具调用:', JSON.parse(data.data));
        break;
      case 'tool_result':
        console.log('工具结果:', JSON.parse(data.data));
        break;
      case 'permission_request':
        console.log('权限请求:', JSON.parse(data.data));
        break;
    }
  }
}
```

### 2. 配置 MCP 服务器

```typescript
import { streamClaude } from '@/lib/claude-client';

const stream = streamClaude({
  prompt: '用户的问题',
  mcpServers: {
    'filesystem': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/path/to/allowed/dir'],
    },
    'github': {
      type: 'stdio',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      env: {
        GITHUB_PERSONAL_ACCESS_TOKEN: process.env.GITHUB_TOKEN,
      },
    },
  },
});
```

### 3. 文件附件支持

```typescript
const stream = streamClaude({
  prompt: '请分析这张图片',
  files: [
    {
      id: 'file-1',
      name: 'screenshot.png',
      type: 'image/png',
      size: 12345,
      data: base64EncodedImageData, // base64 编码的图片数据
    },
  ],
});
```

### 4. 权限处理

权限请求会通过 SSE 事件发送：

```typescript
{
  type: 'permission_request',
  data: JSON.stringify({
    permissionRequestId: 'perm-xxx',
    toolName: 'write_file',
    toolInput: { path: '/some/file.txt', content: '...' },
    suggestions: [{ allow: true, reason: '安全操作' }],
  })
}
```

客户端需要调用 `/api/chat/permission` 端点来响应：

```typescript
await fetch('/api/chat/permission', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    permissionRequestId: 'perm-xxx',
    behavior: 'allow', // 或 'deny'
  }),
});
```

## 与主项目的差异

### 简化的配置管理

主项目使用 SQLite 数据库存储配置，chat-panel-fullstack 使用环境变量：

**主项目**：
```typescript
import { getSetting, getActiveProvider } from './db';
```

**chat-panel-fullstack**：
```typescript
import { getSetting, getActiveProvider } from './config-helper';
```

### 环境变量映射

| 主项目数据库字段 | chat-panel-fullstack 环境变量 |
|-----------------|------------------------------|
| `anthropic_auth_token` | `ANTHROPIC_AUTH_TOKEN` |
| `anthropic_base_url` | `ANTHROPIC_BASE_URL` |
| `dangerously_skip_permissions` | `DANGEROUSLY_SKIP_PERMISSIONS` |

## 注意事项

1. **Claude CLI 依赖**：需要安装 Claude CLI (`npm install -g @anthropic-ai/claude`)
2. **Skills 配置**：Skills 从 `~/.claude/` 目录自动加载
3. **权限模式**：默认使用 `acceptEdits` 模式，可通过 `permissionMode` 参数修改
4. **会话管理**：通过 `sdkSessionId` 参数实现会话恢复

## 故障排除

### Claude CLI 未找到

如果看到 "Claude binary not found" 警告：

```bash
# 安装 Claude CLI
npm install -g @anthropic-ai/claude

# 验证安装
claude --version
```

### API 密钥配置

确保在 `.env.local` 中正确配置了 API 密钥：

```bash
# 检查环境变量
echo $ANTHROPIC_API_KEY
```

### MCP 服务器连接失败

检查 MCP 服务器配置：
- stdio 模式：确保 `command` 和 `args` 正确
- SSE/HTTP 模式：确保 `url` 可访问

## 更多资源

- [Claude Agent SDK 文档](https://github.com/anthropics/anthropic-sdk-typescript)
- [MCP 协议规范](https://modelcontextprotocol.io/)
- [Skills 开发指南](https://docs.anthropic.com/claude/docs/skills)
