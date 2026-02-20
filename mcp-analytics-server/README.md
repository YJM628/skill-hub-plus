# @skillshub/mcp-analytics

MCP Server for Skills Hub Analytics - Enable Claude AI to directly track skill invocations and query analytics data.

## Features

- **track_skill_invoke**: Track skill executions with timing, success/failure, cost
- **track_user_feedback**: Record user 👍/👎 feedback
- **query_analytics**: Query analytics data (overview, trends, top skills, etc.)
- **export_analytics_data**: Export data to JSON or CSV files
- **get_analytics_overview**: Quick overview of key metrics

## Installation

1. Build the MCP Server:
```bash
cd mcp-analytics-server
npm install
npm run build
```

2. Configure Claude Desktop:

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "skills-hub-analytics": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-analytics-server/dist/index.js"],
      "env": {
        "ANALYTICS_ENDPOINT": "http://127.0.0.1:19823"
      }
    }
  }
}
```

3. Restart Claude Desktop

## Usage

Ask Claude:
- "Track this API call: skill_id=weather, duration=1.5s, success=true"
- "Show me analytics overview for the past 7 days"
- "Export last month's data to CSV"

## Requirements

- Skills Hub app running (provides ingest server on 127.0.0.1:19823)
- Node.js >= 18.0.0
