// App Context - Global application state and utilities

import { createContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

interface AppContextValue {
  isTauri: boolean;
  invokeTauri: <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;
  formatErrorMessage: (raw: string) => string;
}

export const AppContext = createContext<AppContextValue | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();

  const isTauri =
    typeof window !== 'undefined' &&
    Boolean(
      (window as { __TAURI__?: unknown }).__TAURI__ ||
        (window as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__,
    );

  const invokeTauri = useCallback(
    async <T,>(command: string, args?: Record<string, unknown>) => {
      if (!isTauri) {
        throw new Error(t('errors.notTauri'));
      }
      const { invoke } = await import('@tauri-apps/api/core');
      return invoke<T>(command, args);
    },
    [isTauri, t],
  );

  const formatErrorMessage = useCallback(
    (raw: string) => {
      if (raw.includes('skill already exists in central repo')) {
        return t('errors.skillExistsInHub');
      }
      if (raw.startsWith('TARGET_EXISTS|')) {
        return t('errors.targetExists');
      }
      if (raw.startsWith('TOOL_NOT_INSTALLED|')) {
        return t('errors.toolNotInstalled');
      }
      if (raw.includes('未在该仓库中发现可导入的 Skills')) {
        return t('errors.noSkillsFoundInRepo');
      }
      return raw;
    },
    [t],
  );

  const value: AppContextValue = {
    isTauri,
    invokeTauri,
    formatErrorMessage,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}