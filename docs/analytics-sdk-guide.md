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

### 用户反馈

```typescript
// 追踪用户反馈（点赞/点踩）
tracker.feedback({
  sessionId: 'session-123',
  score: 1,  // 1 表示点赞，-1 表示点踩
  metadata: { source: 'ui-button' }
})
```

## 数据导出功能

SDK 提供了完整的数据导出功能，支持将追踪的事件数据导出为 JSON 或 CSV 格式。

```typescript
// 导出为 JSON
const jsonResult = await tracker.exportEvents('json', './output/data.json')
console.log(`导出了 ${jsonResult.eventCount} 个事件`)

// 导出为 CSV
const csvResult = await tracker.exportEvents('csv', './output/data.csv')
```

## 许可证

MIT

## 支持

如有问题和疑问，请访问 Skills Hub 文档或联系开发团队。
