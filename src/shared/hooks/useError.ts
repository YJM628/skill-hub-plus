// Shared error state hook

import { useState } from 'react';

export function useError() {
  const [error, setError] = useState<string | null>(null);

  const clearError = () => {
    setError(null);
  };

  return {
    error,
    setError,
    clearError,
  };
}
