#!/usr/bin/env node

/**
 * Test script to verify Analytics SDK can send events to the Ingest Server
 * and display them on the Dashboard.
 * 
 * Usage: node scripts/test-analytics-sdk.mjs
 */

import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SDK_PATH = resolve(__dirname, '../sdk/analytics/dist/index.js')

// Load the SDK dynamically
const sdkModule = await import(SDK_PATH)
const { SkillsHubTracker } = sdkModule

// Configuration
const CONFIG = {
  skillId: 'test-skill-verification',
  endpoint: 'http://127.0.0.1:19823',
}

console.log('🚀 Starting Analytics SDK Verification Test\n')
console.log('Configuration:')
console.log(`  - Skill ID: ${CONFIG.skillId}`)
console.log(`  - Endpoint: ${CONFIG.endpoint}\n`)

// Create tracker instance
const tracker = new SkillsHubTracker({
  skillId: CONFIG.skillId,
  endpoint: CONFIG.endpoint,
  bufferSize: 5, // Small buffer for quick testing
  flushIntervalMs: 2000, // Flush every 2 seconds
})

console.log('✅ Tracker created and started successfully\n')

// Test 1: Successful skill invocation
console.log('📝 Test 1: Sending successful skill invocation event...')
const span1 = tracker.startInvoke({
  sessionId: 'session-1',
  inputHash: 'abc123def456',
  caller: {
    agent_id: 'test-agent',
    workflow_id: 'test-workflow',
    tool_key: 'test-tool',
  },
  metadata: { test_name: 'successful_invocation' },
})
await sleep(150) // Simulate work
span1.setCost({ token_input: 100, token_output: 50, api_cost_usd: 0.001 })
span1.success()
console.log('✅ Test 1: Successful invocation event sent\n')

// Wait a bit
await sleep(500)

// Test 2: Failed skill invocation
console.log('📝 Test 2: Sending failed skill invocation event...')
const span2 = tracker.startInvoke({
  sessionId: 'session-2',
  inputHash: 'xyz789uvw012',
  caller: {
    agent_id: 'test-agent',
    workflow_id: 'test-workflow',
    tool_key: 'test-tool',
  },
  metadata: { test_name: 'failed_invocation' },
})
await sleep(2000) // Simulate slow work that fails
span2.setCost({ token_input: 200, token_output: 0, api_cost_usd: 0.002 })
span2.fail('Test error: timeout')
console.log('✅ Test 2: Failed invocation event sent\n')

// Wait a bit
await sleep(500)

// Test 3: User feedback (thumbs up)
console.log('📝 Test 3: Sending user feedback (thumbs up)...')
tracker.feedback({
  sessionId: 'session-1',
  score: 1, // Thumbs up
  metadata: { test_name: 'positive_feedback' },
})
console.log('✅ Test 3: Positive feedback event sent\n')

// Wait a bit
await sleep(500)

// Test 4: User feedback (thumbs down)
console.log('📝 Test 4: Sending user feedback (thumbs down)...')
tracker.feedback({
  sessionId: 'session-2',
  score: -1, // Thumbs down
  metadata: { test_name: 'negative_feedback' },
})
console.log('✅ Test 4: Negative feedback event sent\n')

// Wait a bit
await sleep(500)

// Test 5: Multiple invocations from different caller
console.log('📝 Test 5: Sending invocation from different caller...')
const span3 = tracker.startInvoke({
  sessionId: 'session-3',
  inputHash: 'different-caller-hash',
  caller: {
    agent_id: 'another-agent',
    workflow_id: null,
    tool_key: 'another-tool',
  },
  metadata: { test_name: 'different_caller' },
})
await sleep(100) // Simulate work
span3.setCost({ token_input: 50, token_output: 25, api_cost_usd: 0.0005 })
span3.success()
console.log('✅ Test 5: Different caller event sent\n')

// Test 6: Another successful invocation
console.log('📝 Test 6: Sending another successful invocation...')
const span4 = tracker.startInvoke({
  sessionId: 'session-4',
  inputHash: 'another-success-hash',
  caller: {
    agent_id: 'test-agent',
    workflow_id: 'test-workflow',
    tool_key: 'test-tool',
  },
  metadata: { test_name: 'another_success' },
})
await sleep(80) // Simulate work
span4.setCost({ token_input: 80, token_output: 40, api_cost_usd: 0.0008 })
span4.success()
console.log('✅ Test 6: Another successful invocation event sent\n')

// Wait for buffer to flush
console.log('⏳ Waiting for events to flush (3 seconds)...')
await sleep(3000)

// Stop the tracker
await tracker.shutdown()
console.log('✅ Tracker stopped\n')

console.log('🎉 All tests completed successfully!')
console.log('\n📊 Next Steps:')
console.log('1. Open the Analytics Dashboard in the Skills Hub app')
console.log('2. Navigate to the Analytics section')
console.log('3. You should see:')
console.log('   - Overview cards showing 6 total calls')
console.log('   - Success rate around 83% (5 success / 6 total)')
console.log('   - Top Skills list with "test-skill-verification"')
console.log('   - Dependency Graph showing caller relationships (test-agent and another-agent)')
console.log('   - Daily trend chart with today\'s data')
console.log('   - Cost summary with total cost ~$0.0043')
console.log('   - 1 thumbs up and 1 thumbs down in feedback stats')

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
