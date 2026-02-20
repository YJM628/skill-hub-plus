// Shared loading state hook

import { useState } from 'react';

export function useLoading() {
  const [loading, setLoading] = useState(false);
  const [loadingStartAt, setLoadingStartAt] = useState<number | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const startLoading = (message?: string) => {
    setLoading(true);
    setLoadingStartAt(Date.now());
    setActionMessage(message || null);
  };

  const stopLoading = () => {
    setLoading(false);
    setLoadingStartAt(null);
    setActionMessage(null);
  };

  const updateActionMessage = (message: string) => {
    setActionMessage(message);
  };

  return {
    loading,
    loadingStartAt,
    actionMessage,
    startLoading,
    stopLoading,
    updateActionMessage,
  };
}
