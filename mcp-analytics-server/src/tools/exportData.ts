import * as fs from 'node:fs'
import * as path from 'node:path'
import { Transport } from '../lib/transport.js'

export const definition = {
  name: "export_analytics_data",
  description: "Export analytics data to a file in JSON or CSV format",
  inputSchema: {
    type: "object",
    properties: {
      format: {
        type: "string",
        enum: ["json", "csv"],
        description: "Export format"
      },
      output_path: {
        type: "string",
        description: "Output file path (optional, defaults to current directory)"
      },
      date_range: {
        type: "object",
        description: "Date range filter",
        properties: {
          start: { type: "string", format: "date-time" },
          end: { type: "string", format: "date-time" }
        }
      },
      skill_id: {
        type: "string",
        description: "Optional skill ID to filter"
      }
    },
    required: ["format"]
  }
}

export async function handler(args: any) {
  const { format, output_path, date_range, skill_id } = args
  
  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)

  try {
    // Query all relevant data
    const overview = await transport.query('/v1/analytics/overview', { days: '30' })
    const dailyTrend = await transport.query('/v1/analytics/daily_trend', { days: '30' })
    const topSkills = await transport.query('/v1/analytics/top_skills', { days: '30', limit: '50' })
    const costSummary = await transport.query('/v1/analytics/cost_summary', { days: '30' })

    const exportData = {
      export_timestamp: new Date().toISOString(),
      date_range: date_range || { start: null, end: null },
      skill_filter: skill_id || null,
      overview,
      daily_trend: dailyTrend,
      top_skills: topSkills,
      cost_summary: costSummary
    }

    // Determine output path
    const defaultPath = `analytics_export_${Date.now()}.${format}`
    const finalPath = output_path || path.join(process.cwd(), defaultPath)

    // Write file
    if (format === 'json') {
      fs.writeFileSync(finalPath, JSON.stringify(exportData, null, 2), 'utf-8')
    } else {
      const csvContent = convertToCSV(exportData)
      fs.writeFileSync(finalPath, csvContent, 'utf-8')
    }

    return {
      content: [
        {
          type: "text",
          text: `📊 Analytics data exported successfully!\n\n` +
                `**Format:** ${format.toUpperCase()}\n` +
                `**File:** ${finalPath}\n` +
                `**Size:** ${fs.statSync(finalPath).size.toLocaleString()} bytes\n\n` +
                `You can now open this file in your preferred tool for further analysis.`
        },
      ],
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `❌ Failed to export analytics data: ${error instanceof Error ? error.message : String(error)}\nPlease ensure Skills Hub app is running.`,
        },
      ],
    }
  }
}

function convertToCSV(data: any): string {
  const lines: string[] = []

  // Overview section
  lines.push('# Overview')
  lines.push(`Total Calls,${data.overview.total_calls || 0}`)
  lines.push(`Active Users,${data.overview.active_users || 0}`)
  lines.push(`Success Rate,${data.overview.success_rate ? (data.overview.success_rate * 100).toFixed(2) : 'N/A'}%`)
  lines.push(`Avg Duration (ms),${data.overview.avg_duration_ms || 0}`)
  lines.push(`Total Cost (USD),${data.overview.total_cost_usd || 0}`)
  lines.push('')

  // Top Skills section
  lines.push('# Top Skills')
  lines.push('Skill ID,Call Count,Success Rate,Avg Duration (ms),Total Cost (USD)')
  if (data.top_skills && Array.isArray(data.top_skills)) {
    data.top_skills.forEach((skill: any) => {
      lines.push(
        `${skill.skill_id},` +
        `${skill.call_count},` +
        `${(skill.success_rate * 100).toFixed(2)}%,` +
        `${skill.avg_duration_ms || 0},` +
        `${skill.total_cost_usd || 0}`
      )
    })
  }

  return lines.join('\n')
}
