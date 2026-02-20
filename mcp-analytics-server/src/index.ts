#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { handler as trackInvokeHandler, definition as trackInvokeDefinition } from './tools/trackInvoke.js'
import { handler as trackFeedbackHandler, definition as trackFeedbackDefinition } from './tools/trackFeedback.js'
import { handler as queryAnalyticsHandler, definition as queryAnalyticsDefinition } from './tools/queryAnalytics.js'
import { handler as getOverviewHandler, definition as getOverviewDefinition } from './tools/getOverview.js'
import { handler as exportDataHandler, definition as exportDataDefinition } from './tools/exportData.js'

const server = new Server(
  {
    name: 'skills-hub-analytics',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      trackInvokeDefinition,
      trackFeedbackDefinition,
      queryAnalyticsDefinition,
      getOverviewDefinition,
      exportDataDefinition,
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params

  try {
    switch (name) {
      case 'track_skill_invoke':
        return await trackInvokeHandler(args)
      
      case 'track_user_feedback':
        return await trackFeedbackHandler(args)
      
      case 'query_analytics':
        return await queryAnalyticsHandler(args)
      
      case 'get_analytics_overview':
        return await getOverviewHandler(args)
      
      case 'export_analytics_data':
        return await exportDataHandler(args)
      
      default:
        throw new Error(`Unknown tool: ${name}`)
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
        },
      ],
      isError: true,
    }
  }
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('Skills Hub Analytics MCP Server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error in main():', error)
  process.exit(1)
})
