# AI Chat Panel - Full Stack Solution

基于 `chat-panel-core` 组件库的完整前后端 AI 聊天解决方案。

## 功能特性

- 🚀 **SSE 流式对话** - 实时 AI 响应流
- 🛠️ **工具调用** - 时间查询、数学计算、网络搜索等
- 🔒 **权限管理** - 工具执行前的用户确认机制
- 💬 **会话管理** - 多会话支持和消息持久化
- 🎯 **模型切换** - 支持 Claude 和 OpenAI 模型
- 📱 **响应式设计** - 完美适配桌面和移动端
- ⚡ **高性能** - 基于 Next.js 15 和 React 18

## 技术栈

- **前端**: Next.js 15 + React 18 + TypeScript + Tailwind CSS
- **后端**: Next.js API Routes + SSE
- **AI 集成**: Anthropic Claude SDK + OpenAI SDK
- **UI 组件**: chat-panel-core（自研聊天组件库）
- **样式**: Tailwind CSS + CSS Variables
- **部署**: Vercel / Docker

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 环境配置

复制环境变量模板：

```bash
cp .env.local.example .env.local
```

配置 AI API 密钥（支持三种方式）：

#### 方式 1：环境变量（推荐用于生产环境）

编辑 `.env.local` 文件：

```env
# 选择 AI 提供商：'anthropic' 或 'openai'
AI_PROVIDER=anthropic

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-your-api-key-here
# 或使用 AUTH_TOKEN
# ANTHROPIC_AUTH_TOKEN=sk-ant-your-auth-token-here

# 可选：自定义 API 端点
# ANTHROPIC_BASE_URL=https://api.anthropic.com

# OpenAI API（如果使用 OpenAI）
# OPENAI_API_KEY=sk-your-openai-key-here
# OPENAI_BASE_URL=https://api.openai.com/v1
```

#### 方式 2：本地 CLI 配置（推荐用于开发环境）

创建 `~/.claude/settings.json` 文件，支持两种格式：

**格式 1（简单格式）：**
```json
{
  "api_key": "sk-ant-your-api-key-here",
  "base_url": "https://api.anthropic.com"
}
```

**格式 2（Claude CLI 标准格式 - 推荐）：**
```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "sk-ant-your-api-key-here",
    "ANTHROPIC_BASE_URL": "https://api.anthropic.com"
  }
}
```

这种方式的优点：
- ✅ 无需在项目中配置敏感信息
- ✅ 多个项目共享同一配置
- ✅ 与 Claude CLI 工具配置一致

#### 方式 3：系统环境变量

```bash
# macOS/Linux
export ANTHROPIC_API_KEY="sk-ant-your-api-key-here"

# Windows (PowerShell)
$env:ANTHROPIC_API_KEY="sk-ant-your-api-key-here"
```

**配置优先级**（从高到低）：
1. 项目 `.env.local` 文件
2. 系统环境变量
3. 本地 CLI 配置文件 `~/.claude/settings.json`

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 查看应用。

## 项目结构

```
chat-panel-fullstack/
├── src/
│   ├── app/
│   │   ├── api/chat/           # SSE 聊天 API
│   │   ├── layout.tsx          # 应用布局
│   │   └── page.tsx            # 主页面
│   ├── components/
│   │   └── chat-demo.tsx       # 聊天演示组件
│   └── lib/
│       ├── ai-client.ts        # AI SDK 封装
│       ├── session-store.ts    # 会话存储
│       └── tools.ts            # 工具执行器
├── chat-panel-core/            # 聊天组件库
└── package.json
```

## API 接口

### POST /api/chat

SSE 流式聊天接口

**请求体:**
```json
{
  "session_id": "string",
  "content": "string",
  "model": "string (optional)"
}
```

**响应流事件:**
- `text` - AI 文本增量
- `tool_use` - 工具调用开始
- `tool_result` - 工具调用结果
- `permission_request` - 权限请求
- `status` - 状态更新
- `result` - 最终结果
- `error` - 错误信息
- `done` - 流结束

### POST /api/chat/permission

工具权限确认接口

**请求体:**
```json
{
  "permissionRequestId": "string",
  "decision": "allow" | "deny"
}
```

## 可用工具

- **get_current_time** - 获取当前时间
- **calculate** - 数学计算
- **search_web** - 网络搜索（模拟）

## 自定义配置

### 添加新工具

1. 在 `src/lib/ai-client.ts` 中添加工具定义
2. 在 `src/lib/tools.ts` 中实现工具执行逻辑
3. 配置权限要求（可选）

### 切换 AI 模型

修改 `.env.local` 中的配置：

```env
AI_PROVIDER=openai
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o
```

### 自定义 UI

修改 `src/components/chat-demo.tsx` 中的 ChatPanel 配置：

```tsx
<ChatPanel
  sessionId="your-session"
  config={{
    title: "Custom AI Assistant",
    description: "Your custom description",
    models: [...],
    defaultModel: "your-model",
  }}
/>
```

## 部署

### Vercel 部署

1. 推送代码到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署完成

### Docker 部署

```bash
# 构建镜像
docker build -t chat-panel-fullstack .

# 运行容器
docker run -p 3000:3000 \
  -e ANTHROPIC_API_KEY=your_key \
  chat-panel-fullstack
```

## 开发指南

### 添加新页面

在 `src/app/` 目录下创建新的路由文件。

### 修改样式

- 全局样式：`src/app/globals.css`
- 组件样式：使用 Tailwind CSS 类名
- 主题变量：CSS Variables in `globals.css`

### 扩展功能

- 会话持久化：替换 `session-store.ts` 为数据库实现
- 文件上传：扩展 API 和前端组件
- 用户认证：添加身份验证中间件

## 许可证

MIT License