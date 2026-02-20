# @skillshub/analytics

Skills Hub Analytics SDK - 零入侵追踪技能调用、成本和用户反馈。

## 功能特性

- **零入侵追踪**：无需修改代码结构即可追踪函数调用
- **自动批处理**：事件缓冲并自动刷新
- **离线支持**：服务器不可用时本地缓存事件
- **丰富元数据**：追踪成本、调用者信息和自定义元数据
- **用户反馈**：内置用户反馈收集支持
- **类型安全**：完整的 TypeScript 支持和全面的类型定义

## 安装

```bash
npm install @skillshub/analytics
```

## 快速开始

### 基础用法

```typescript
import { SkillsHubTracker } from '@skillshub/analytics'

// 初始化追踪器
const tracker = new SkillsHubTracker({
  skillId: 'my-skill-id',
  endpoint: 'http://127.0.0.1:19823', // 可选，默认为 localhost:19823
  bufferSize: 100,                   // 可选，默认为 100
  flushIntervalMs: 5000,             // 可选，默认为 5000ms
})

// 追踪函数调用
const span = tracker.startInvoke({
  sessionId: 'session-123',
  inputHash: 'input-hash-abc',
  metadata: { userId: 'user-456' }
})

try {
  // 你的函数逻辑
  const result = await myFunction()
  span.success()
} catch (error) {
  span.fail(error)
}

// 完成后清理
await tracker.shutdown()
```

### 零入侵函数包装

```typescript
import { SkillsHubTracker } from '@skillshub/analytics'

const tracker = new SkillsHubTracker({ skillId: 'my-skill-id' })

// 包装任何异步函数
const trackedFetch = tracker.wrap(fetchWeather, {
  sessionId: 'session-123',
  hashInput: (args) => JSON.stringify(args),  // 可选：自定义哈希函数
  extractMetadata: (args) => ({ city: args[0] }) // 可选：提取元数据
})

// 像使用原函数一样使用包装后的函数
const weather = await trackedFetch('Beijing')
// 事件会自动被追踪！
```

### 追踪成本信息

```typescript
const span = tracker.startInvoke({ sessionId: 'session-123' })

// 附加成本信息
span.setCost({
  token_input: 100,
  token_output: 50,
  api_cost_usd: 0.001
})

span.success()
```

### 追踪调用者信息

```typescript
const span = tracker.startInvoke({ sessionId: 'session-123' })

// 附加调用者信息
span.setCaller({
  agent_id: 'agent-123',
  workflow_id: 'workflow-456',
  tool_key: 'tool-789'
})

span.success()
```

### 用户反馈

```typescript
// 追踪用户反馈（点赞/点踩）
tracker.feedback({
  sessionId: 'session-123',
  score: 1,  // 1 表示点赞，-1 表示点踩
  metadata: { source: 'ui-button' }
})
```

## 配置选项

```typescript
interface TrackerConfig {
  /** Skills Hub 安装时分配的技能 ID */
  skillId: string
  
  /** 数据接收服务器端点（默认：http://127.0.0.1:19823） */
  endpoint?: string
  
  /** 自动刷新前缓冲的最大事件数（默认：100） */
  bufferSize?: number
  
  /** 自动刷新间隔（毫秒）（默认：5000） */
  flushIntervalMs?: number
  
  /** 离线事件存储目录（默认：~/.skillshub/analytics_buffer/） */
  fallbackPath?: string
  
  /** 用户 ID — 如果不提供则自动生成 */
  userId?: string
}
```

## 事件类型

SDK 追踪以下事件类型：

- **skill_invoke**：函数/技能调用，包含成功/失败状态
- **skill_feedback**：用户反馈（点赞/点踩）
- **skill_error**：错误事件，包含详细错误信息

## Event Data Structure

```typescript
interface SkillEvent {
  event_type: 'skill_invoke' | 'skill_feedback' | 'skill_error'
  skill_id: string
  timestamp: string
  user_id: string
  session_id: string
  input_hash: string
  success: boolean
  duration_ms: number
  error: string | null
  feedback_score: number | null
  cost: CostInfo | null
  caller: CallerInfo | null
  metadata: Record<string, unknown>
}
```

## 高级用法

### 自定义会话管理

```typescript
// 生成自定义会话 ID
import { randomUUID } from 'crypto'

const sessionId = randomUUID()
const span = tracker.startInvoke({ 
  sessionId,
  metadata: { customField: 'value' }
})
```

### 错误处理

SDK 自动处理网络错误并回退到本地存储：

```typescript
// 服务器不可用时事件会在本地缓存
const tracker = new SkillsHubTracker({
  skillId: 'my-skill-id',
  endpoint: 'http://unavailable-server:19823'
})

// 这会在本地缓存事件
span.success()

// 服务器可用时事件会被发送
```

### 手动刷新控制

```typescript
// 强制刷新所有缓冲的事件
await tracker.shutdown()

// 或者让 SDK 处理自动刷新
// 根据 bufferSize 和 flushIntervalMs 自动管理
```

## 自动追踪

要实现完全自动追踪，使用自动追踪器：

```typescript
import { createAutoTracker } from '@skillshub/analytics'

const autoTracker = createAutoTracker({
  skillId: 'my-skill-id',
  // 自动追踪当前上下文中的所有函数调用
})

// 所有函数调用现在都会被自动追踪
await myFunction1()
await myFunction2()

await autoTracker.shutdown()
```

## 开发

### 构建

```bash
npm run build
```

### 测试

```bash
npm test
```

## 服务器要求

SDK 向 HTTP 数据接收服务器发送事件，规格如下：

- **端点**：`POST /v1/events`
- **Content-Type**：`application/json`
- **请求体**：

```json
{
  "events": [
    {
      "event_type": "skill_invoke",
      "skill_id": "my-skill-id",
      "timestamp": "2026-02-16T00:00:00Z",
      "user_id": "user-123",
      "session_id": "session-456",
      "input_hash": "abc123",
      "success": true,
      "duration_ms": 150,
      "error": null,
      "feedback_score": null,
      "cost": null,
      "caller": null,
      "metadata": {}
    }
  ]
}
```

## 最佳实践

1. **务必关闭**：应用程序退出时调用 `await tracker.shutdown()`
2. **使用有意义的会话 ID**：使用相同的会话 ID 分组相关操作
3. **添加相关元数据**：包含有助于调试和分析的上下文
4. **追踪成本**：通过附加成本信息监控 API 成本
5. **处理错误**：始终使用 try-catch 块和 span.fail()
6. **导出分析数据**：使用 Skills Hub 仪表盘的导出功能将分析数据导出为 CSV 或 JSON 格式，便于进行自定义分析和报告生成

## 数据导出功能

SDK 提供了完整的数据导出功能，支持将追踪的事件数据导出为 JSON 或 CSV 格式，便于进行自定义分析和报告生成。

### 导出格式

#### JSON 格式
- **用途**：适合程序化处理、API 集成和深度数据分析
- **内容**：包含完整的结构化数据，包括所有元数据和嵌套对象
- **特点**：支持日期范围过滤

#### CSV 格式
- **用途**：适合在 Excel、Google Sheets 等表格软件中查看和分析
- **内容**：包含所有事件字段的表格形式数据
- **特点**：支持日期范围过滤，CSV 值自动转义

### 使用方法

#### 通过 SkillsHubTracker 导出

```typescript
import { SkillsHubTracker } from '@skillshub/analytics'

const tracker = new SkillsHubTracker({ skillId: 'my-skill-id' })

// 追踪一些事件
const span1 = tracker.startInvoke({ sessionId: 'session-1' })
// ... do work ...
span1.success()

const span2 = tracker.startInvoke({ sessionId: 'session-2' })
// ... do work ...
span2.success()

// 导出为 JSON
const jsonResult = await tracker.exportEvents('json', './output/data.json')
console.log(`导出了 ${jsonResult.eventCount} 个事件到 ${jsonResult.filePath}`)

// 导出为 CSV
const csvResult = await tracker.exportEvents('csv', './output/data.csv')
console.log(`导出了 ${csvResult.eventCount} 个事件到 ${csvResult.filePath}`)
```

#### 使用 AnalyticsExporter 直接导出

```typescript
import { AnalyticsExporter } from '@skillshub/analytics'
import type { SkillEvent } from '@skillshub/analytics'

// 获取事件数据
const events: SkillEvent[] = tracker.getEvents()

// 导出为 JSON
const jsonResult = await AnalyticsExporter.export(events, {
  format: 'json',
  outputPath: './output/data.json',
  dateRange: {
    start: '2026-02-01T00:00:00Z',
    end: '2026-02-16T23:59:59Z'
  }
})

// 导出为 CSV
const csvResult = await AnalyticsExporter.exportToCSV(events, {
  format: 'csv',
  outputPath: './output/data.csv'
})
```

### 导出内容

导出的数据包含以下字段：

- **event_type**: 事件类型（skill_invoke、skill_feedback、skill_error）
- **skill_id**: 技能 ID
- **timestamp**: 事件时间戳
- **user_id**: 用户 ID
- **session_id**: 会话 ID
- **input_hash**: 输入哈希值
- **success**: 是否成功
- **duration_ms**: 执行时长（毫秒）
- **error**: 错误信息（如果有）
- **feedback_score**: 反馈分数（如果有）
- **cost_token_input**: 输入 token 数量
- **cost_token_output**: 输出 token 数量
- **cost_api_usd**: API 成本（美元）
- **caller_agent_id**: 调用者代理 ID
- **caller_workflow_id**: 调用者工作流 ID
- **caller_tool_key**: 调用者工具 key

### 高级选项

#### 日期范围过滤

```typescript
const result = await tracker.exportEvents('json', './output/data.json')
// 或使用 AnalyticsExporter
const result = await AnalyticsExporter.export(events, {
  format: 'json',
  dateRange: {
    start: '2026-02-01T00:00:00Z',
    end: '2026-02-16T23:59:59Z'
  }
})
```

#### 自定义输出路径

```typescript
// 相对路径
await tracker.exportEvents('csv', './reports/analytics.csv')

// 绝对路径
await tracker.exportEvents('json', '/absolute/path/to/data.json')

// 不指定路径，使用默认路径（当前工作目录）
await tracker.exportEvents('json')
```

### 使用场景

导出功能适用于以下场景：
- **自定义报告**：根据业务需求生成定制化的分析报告
- **数据集成**：将分析数据集成到现有的 BI 工具或数据仓库
- **趋势分析**：在 Excel 或其他数据工具中进行深入的趋势分析和可视化
- **审计跟踪**：保存历史追踪数据以进行审计和对比
- **团队共享**：与团队成员或利益相关者共享分析结果
- **离线分析**：在没有网络连接的情况下分析追踪数据

## 许可证

MIT

## 支持

如有问题和疑问，请访问 Skills Hub 文档或联系开发团队。