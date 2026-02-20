// Shared toast notification hook

import { useState } from 'react';
import { toast } from 'sonner';

export function useToast() {
  const [successToastMessage, setSuccessToastMessage] = useState<string | null>(null);

  const showSuccess = (message: string) => {
    setSuccessToastMessage(message);
    toast.success(message);
    // Auto-clear after toast duration
    setTimeout(() => setSuccessToastMessage(null), 2000);
  };

  const showError = (message: string) => {
    toast.error(message);
  };

  const showInfo = (message: string) => {
    toast.info(message);
  };

  return {
    successToastMessage,
    setSuccessToastMessage,
    showSuccess,
    showError,
    showInfo,
  };
}
