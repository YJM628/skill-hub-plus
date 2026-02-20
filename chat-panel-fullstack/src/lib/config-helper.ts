/**
 * Simplified configuration helper for standalone chat-panel-fullstack
 * Reads configuration from environment variables instead of database
 */

export function getSetting(key: string): string | undefined {
  // Map setting keys to environment variables
  const envMap: Record<string, string> = {
    'anthropic_auth_token': 'ANTHROPIC_AUTH_TOKEN',
    'anthropic_base_url': 'ANTHROPIC_BASE_URL',
    'dangerously_skip_permissions': 'DANGEROUSLY_SKIP_PERMISSIONS',
  };

  const envKey = envMap[key];
  return envKey ? process.env[envKey] : undefined;
}

export interface ApiProvider {
  id: string;
  name: string;
  provider_type: string;
  base_url: string;
  api_key: string;
  is_active: number;
  extra_env: string;
}

export function getActiveProvider(): ApiProvider | undefined {
  // For standalone version, read from environment variables
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;
  const baseUrl = process.env.ANTHROPIC_BASE_URL;

  if (!apiKey) {
    return undefined;
  }

  return {
    id: 'env-provider',
    name: 'Environment Provider',
    provider_type: 'anthropic',
    base_url: baseUrl || '',
    api_key: apiKey,
    is_active: 1,
    extra_env: '{}',
  };
}
