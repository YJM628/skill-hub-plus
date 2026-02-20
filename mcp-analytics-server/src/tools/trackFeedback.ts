import { Transport, SkillEvent } from '../lib/transport.js'

export const definition = {
  name: "track_user_feedback",
  description: "Record user feedback (👍/👎) for a skill invocation",
  inputSchema: {
    type: "object",
    properties: {
      skill_id: { 
        type: "string", 
        description: "The ID of the skill" 
      },
      session_id: { 
        type: "string", 
        description: "Session ID of the invocation being rated" 
      },
      score: { 
        type: "number", 
        enum: [1, -1],
        description: "Feedback score: 1 for 👍 (positive), -1 for 👎 (negative)" 
      },
      metadata: {
        type: "object",
        description: "Custom metadata for the feedback"
      }
    },
    required: ["skill_id", "session_id", "score"]
  }
}

export async function handler(args: any) {
  const { skill_id, session_id, score, metadata } = args

  const endpoint = process.env.ANALYTICS_ENDPOINT ?? 'http://127.0.0.1:19823'
  const transport = new Transport(endpoint)
  
  const event: SkillEvent = {
    event_type: 'skill_feedback',
    skill_id,
    timestamp: new Date().toISOString(),
    user_id: 'mcp_user',
    session_id,
    input_hash: '',
    success: true,
    duration_ms: 0,
    error: null,
    feedback_score: score,
    cost: null,
    caller: null,
    metadata: metadata || {}
  }

  const result = await transport.send([event])

  const emoji = score === 1 ? '👍' : '👎'

  return {
    content: [
      {
        type: "text",
        text: result 
          ? `✅ Recorded user feedback ${emoji} for skill: ${skill_id} (session: ${session_id})`
          : `❌ Failed to record feedback - please ensure Skills Hub app is running`,
      },
    ],
  }
}
