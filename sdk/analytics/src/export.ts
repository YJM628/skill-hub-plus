import * as fs from 'node:fs'
import * as path from 'node:path'
import type { SkillEvent } from './types'

export interface ExportOptions {
  format: 'json' | 'csv'
  outputPath?: string
  includeMetadata?: boolean
  dateRange?: {
    start: string
    end: string
  }
}

export interface ExportResult {
  filePath: string
  eventCount: number
  format: 'json' | 'csv'
}

export class AnalyticsExporter {
  static async exportToJSON(
    events: SkillEvent[],
    options: ExportOptions = { format: 'json' },
  ): Promise<ExportResult> {
    const filteredEvents = this.filterEvents(events, options)
    const outputPath = this.getOutputPath(options.outputPath, 'json')

    const exportData = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      eventCount: filteredEvents.length,
      data: filteredEvents,
      ...(options.dateRange && { dateRange: options.dateRange }),
    }

    await fs.promises.writeFile(
      outputPath,
      JSON.stringify(exportData, null, 2),
      'utf-8',
    )

    return {
      filePath: outputPath,
      eventCount: filteredEvents.length,
      format: 'json',
    }
  }

  static async exportToCSV(
    events: SkillEvent[],
    options: ExportOptions = { format: 'csv' },
  ): Promise<ExportResult> {
    const filteredEvents = this.filterEvents(events, options)
    const outputPath = this.getOutputPath(options.outputPath, 'csv')

    const headers = [
      'event_type',
      'skill_id',
      'timestamp',
      'user_id',
      'session_id',
      'input_hash',
      'success',
      'duration_ms',
      'error',
      'feedback_score',
      'cost_token_input',
      'cost_token_output',
      'cost_api_usd',
      'caller_agent_id',
      'caller_workflow_id',
      'caller_tool_key',
    ]

    const csvLines: string[] = [headers.join(',')]

    for (const event of filteredEvents) {
      const row = [
        event.event_type,
        event.skill_id,
        event.timestamp,
        event.user_id,
        event.session_id,
        event.input_hash,
        event.success.toString(),
        event.duration_ms.toString(),
        event.error ? `"${this.escapeCSV(event.error)}"` : '',
        event.feedback_score?.toString() ?? '',
        event.cost?.token_input.toString() ?? '',
        event.cost?.token_output.toString() ?? '',
        event.cost?.api_cost_usd.toString() ?? '',
        event.caller?.agent_id ?? '',
        event.caller?.workflow_id ?? '',
        event.caller?.tool_key ?? '',
      ]
      csvLines.push(row.join(','))
    }

    await fs.promises.writeFile(outputPath, csvLines.join('\n'), 'utf-8')

    return {
      filePath: outputPath,
      eventCount: filteredEvents.length,
      format: 'csv',
    }
  }

  static async export(
    events: SkillEvent[],
    options: ExportOptions,
  ): Promise<ExportResult> {
    if (options.format === 'json') {
      return this.exportToJSON(events, options)
    } else if (options.format === 'csv') {
      return this.exportToCSV(events, options)
    } else {
      throw new Error(`Unsupported export format: ${options.format}`)
    }
  }

  private static filterEvents(
    events: SkillEvent[],
    options: ExportOptions,
  ): SkillEvent[] {
    let filtered = events

    if (options.dateRange) {
      const startDate = new Date(options.dateRange.start)
      const endDate = new Date(options.dateRange.end)
      filtered = filtered.filter((event) => {
        const eventDate = new Date(event.timestamp)
        return eventDate >= startDate && eventDate <= endDate
      })
    }

    return filtered
  }

  private static getOutputPath(
    customPath: string | undefined,
    format: 'json' | 'csv',
  ): string {
    if (customPath) {
      const dir = path.dirname(customPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      return customPath
    }

    const timestamp = new Date().toISOString().split('T')[0]
    const filename = `analytics-export-${timestamp}.${format}`
    return path.join(process.cwd(), filename)
  }

  private static escapeCSV(value: string): string {
    return value.replace(/"/g, '""')
  }
}
