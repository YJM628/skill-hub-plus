import { randomUUID } from 'crypto'
import { Transport, SkillEvent } from '../lib/transport.js'

export const definition = {
  name: "track_skill_invoke",
  description: "Track a skill invocation event, recording execution time, success/failure status, and cost information",
  inputSchema: {
    type: "object",
    properties: {
      skill_id: { 
        type: "string", 
        description: "The ID of the skill being invoked" 
      },
      session_id: { 
        type: "string", 
        description: "Unique session identifier for this invocation" 
      },
      success: { 
        type: "boolean", 
        description: "Whether the invocation succeeded" 
      },
      duration_ms: { 
        type: "number", 
        description: "Execution duration in milliseconds" 
      },
      error: { 
        type: "string", 
        description: "Error message if the invocation failed" 
      },
      cost: {
        type: "object",
        description: "Cost information for the invocation",
        properties: {
          token_input: { type: "number" },
          token_output: { type: "number" },
          api_cost_usd: { type: "number" }
        }
      },
      metadata: {
        type: "object",
        description: "Custom metadata for the event"
      }
    },
    required: ["skill_id", "session_id", "success", "duration_ms"]
  }
}

export async function handler(args: any) {
  const { skill_id, session_id, success, duration_ms, error, cost, metadata } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)
  
  const event: SkillEvent = {
    event_type: 'skill_invoke',
    skill_id,
    timestamp: new Date().toISOString(),
    user_id: 'mcp_user',
    session_id,
    input_hash: randomUUID().slice(0, 16),
    success,
    duration_ms,
    error: error || null,
    feedback_score: null,
    cost: cost ? {
      token_input: cost.token_input || null,
      token_output: cost.token_output || null,
      api_cost_usd: cost.api_cost_usd || null
    } : null,
    caller: null,
    metadata: metadata || {}
  }

  const result = await transport.send([event])

  return {
    content: [
      {
        type: "text",
        text: result 
          ? `✅ Successfully tracked skill invocation: ${skill_id} (session: ${session_id}, success: ${success}, duration: ${duration_ms}ms)`
          : `❌ Failed to track invocation - please ensure Skills Hub app is running and ingest server is accessible at ${endpoint}`,
      },
    ],
  }
}
