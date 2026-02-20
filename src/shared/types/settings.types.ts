// Settings-related type definitions

export interface AppSettings {
  storagePath: string;
  gitCacheCleanupDays: number;
  gitCacheTtlSecs: number;
  autoUpdateEnabled: boolean;
  themePreference: 'light' | 'dark' | 'system';
  translationApiKey: string;
  translationServiceType: string;
}

export interface TranslationSettings {
  serviceType: string;
  apiKey: string;
  googleApiKey: string;
}
