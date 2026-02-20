// Common type definitions used across the application

export interface LoadingState {
  loading: boolean;
  loadingStartAt: number | null;
  actionMessage: string | null;
}

export interface ErrorState {
  error: string | null;
  setError: (error: string | null) => void;
}

export interface ToastState {
  successToastMessage: string | null;
  setSuccessToastMessage: (message: string | null) => void;
}
