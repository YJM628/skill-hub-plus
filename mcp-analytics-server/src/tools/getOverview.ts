import { Transport } from '../lib/transport.js'

export const definition = {
  name: "get_analytics_overview",
  description: "Get a quick analytics overview with key metrics like total calls, active users, success rate, and average response time",
  inputSchema: {
    type: "object",
    properties: {
      days: {
        type: "number",
        description: "Number of days to include in the overview",
        default: 7
      }
    }
  }
}

export async function handler(args: any) {
  const { days = 7 } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  try {
    const data = await transport.query('/v1/analytics/overview', { days: days.toString() })
    
    return {
      content: [
        {
          type: "text",
          text: formatOverview(data, days)
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to get analytics overview: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function formatOverview(data: unknown, days: number): string {
  const overview = data as any
  
  return `📊 Analytics Overview (Past ${days} days)

**Key Metrics:**
- Total Calls: ${overview.total_calls?.toLocaleString() || 'N/A'}
- Active Users: ${overview.active_users?.toLocaleString() || 'N/A'}
- Success Rate: ${overview.success_rate ? `${(overview.success_rate * 100).toFixed(1)}%` : 'N/A'}
- Avg Response Time: ${overview.avg_duration_ms ? `${overview.avg_duration_ms.toFixed(0)}ms` : 'N/A'}
- Total Cost: ${overview.total_cost_usd ? `$${overview.total_cost_usd.toFixed(4)}` : 'N/A'}

**Top Skills:**
${overview.top_skills?.slice(0, 5).map((s: any) => 
  `- ${s.skill_id}: ${s.call_count} calls (${(s.success_rate * 100).toFixed(1)}% success)`
).join('\n') || 'No data available'}
`
}
