import * as fs from 'node:fs'
import * as path from 'node:path'
import { SkillsHubTracker } from './tracker'

interface AnalyticsConfig {
  skill_id: string
  analytics_endpoint?: string
}

/**
 * Auto-configure a tracker by reading analytics.config.json from the skill directory.
 * Skills Hub injects this file during skill installation.
 *
 * Usage in a skill:
 *   import { createAutoTracker } from '@skillshub/analytics'
 *   const tracker = createAutoTracker(__dirname)
 *   export default tracker.wrap(mySkillFunction)
 */
export function createAutoTracker(skillDir: string): SkillsHubTracker {
  const configPath = path.join(skillDir, 'analytics.config.json')

  let config: AnalyticsConfig
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    config = JSON.parse(raw)
  } catch {
    throw new Error(
      `[skillshub/analytics] Cannot read ${configPath}. ` +
      `Ensure this skill was installed via Skills Hub.`
    )
  }

  return new SkillsHubTracker({
    skillId: config.skill_id,
    endpoint: config.analytics_endpoint,
  })
}
