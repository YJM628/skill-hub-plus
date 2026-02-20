# MCP Analytics Server - Usage Examples

## Prerequisites

1. Skills Hub app must be running (provides ingest server on `http://127.0.0.1:19823`)
2. MCP Server must be installed and configured in Claude Desktop

## Example 1: Track a Skill Invocation

Ask Claude:
```
Track this skill invocation:
- skill_id: "weather-api"
- session_id: "session_12345"
- success: true
- duration_ms: 1500
- cost: { token_input: 100, token_output: 50, api_cost_usd: 0.0015 }
```

Claude will use `track_skill_invoke` tool to record the event.

## Example 2: Track User Feedback

Ask Claude:
```
Record positive feedback 👍 for skill "weather-api" in session "session_12345"
```

Claude will use `track_user_feedback` tool with score: 1.

## Example 3: Get Analytics Overview

Ask Claude:
```
Show me the analytics overview for the past 7 days
```

Claude will use `get_analytics_overview` tool and display:
- Total calls
- Active users
- Success rate
- Average response time
- Total cost
- Top skills

## Example 4: Query Specific Analytics

Ask Claude:
```
Get the daily trend for the past 30 days
```

Claude will use `query_analytics` tool with query_type: "daily_trend" and days: 30.

Other query types:
- `top_skills`: Most frequently used skills
- `success_rate`: Success rate over time
- `cost_summary`: Cost breakdown
- `caller_analysis`: Who is calling skills
- `user_retention`: User engagement metrics

## Example 5: Export Data

Ask Claude:
```
Export last month's analytics data to a CSV file
```

Claude will use `export_analytics_data` tool with format: "csv" and save to `analytics_export_<timestamp>.csv`.

## Example 6: Filter by Skill

Ask Claude:
```
Query top skills for skill_id "weather-api" for the past 14 days
```

Claude will use `query_analytics` tool with skill_id filter.

## Example 7: Complete Workflow

```
1. Track the skill invocation
2. Get analytics overview
3. Export data to JSON for further analysis
```

Claude will chain multiple MCP tools to complete the workflow.

## Troubleshooting

### "Failed to track invocation" Error
- Ensure Skills Hub app is running
- Check that ingest server is accessible at `http://127.0.0.1:19823`
- Verify MCP Server is configured correctly in Claude Desktop

### "Failed to query analytics" Error
- Make sure Skills Hub app has analytics data
- Check the ingest server logs for any errors
- Verify the query parameters are valid

## Configuration

To customize the ingest server endpoint, set environment variable:
```bash
export ANALYTICS_ENDPOINT="http://127.0.0.1:19823"
```

Then update Claude Desktop config:
```json
{
  "mcpServers": {
    "skills-hub-analytics": {
      "command": "node",
      "args": ["/path/to/mcp-analytics-server/dist/index.js"],
      "env": {
        "ANALYTICS_ENDPOINT": "http://127.0.0.1:19823"
      }
    }
  }
}
```
