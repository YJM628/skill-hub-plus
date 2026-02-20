import { Transport } from '../lib/transport.js'

export const definition = {
  name: "query_analytics",
  description: "Query analytics data with various dimensions and filters",
  inputSchema: {
    type: "object",
    properties: {
      query_type: {
        type: "string",
        enum: ["overview", "daily_trend", "top_skills", "success_rate", "cost_summary", "caller_analysis", "user_retention"],
        description: "Type of analytics query to execute"
      },
      skill_id: {
        type: "string",
        description: "Optional skill ID to filter results"
      },
      days: {
        type: "number",
        description: "Number of days to include in the query",
        default: 7
      },
      limit: {
        type: "number",
        description: "Maximum number of results to return",
        default: 10
      }
    },
    required: ["query_type"]
  }
}

export async function handler(args: any) {
  const { query_type, skill_id, days = 7, limit = 10 } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  const queryParams: Record<string, string> = {
    days: days.toString()
  }

  if (limit) {
    queryParams.limit = limit.toString()
  }

  if (skill_id) {
    queryParams.skill_id = skill_id
  }

  try {
    const data = await transport.query(`/v1/analytics/${query_type}`, queryParams)
    
    return {
      content: [
        {
          type: "text",
          text: formatQueryResult(query_type, data, days)
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to query analytics: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function formatQueryResult(queryType: string, data: unknown, days: number): string {
  const dataStr = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
  
  const descriptions: Record<string, string> = {
    overview: `📊 Analytics Overview (Past ${days} days)`,
    daily_trend: `📈 Daily Trend (Past ${days} days)`,
    top_skills: `🏆 Top Skills (Past ${days} days)`,
    success_rate: `✅ Success Rate Trend (Past ${days} days)`,
    cost_summary: `💰 Cost Summary (Past ${days} days)`,
    caller_analysis: `🔗 Caller Analysis (Past ${days} days)`,
    user_retention: `👥 User Retention (Past ${days} days)`
  }

  return `${descriptions[queryType] || queryType}\n\n\`\`\`json\n${dataStr}\n\`\`\``
}
