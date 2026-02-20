import type { PermissionResult } from '@anthropic-ai/claude-agent-sdk';

interface PendingPermission {
  resolve: (result: PermissionResult) => void;
  createdAt: number;
  abortSignal?: AbortSignal;
  toolInput: Record<string, unknown>;
}

const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

const globalKey = '__pendingPermissions__' as const;

function getMap(): Map<string, PendingPermission> {
  if (!(globalThis as Record<string, unknown>)[globalKey]) {
    (globalThis as Record<string, unknown>)[globalKey] = new Map<string, PendingPermission>();
  }
  return (globalThis as Record<string, unknown>)[globalKey] as Map<string, PendingPermission>;
}

function cleanupExpired() {
  const map = getMap();
  const now = Date.now();
  for (const [id, entry] of map) {
    if (now - entry.createdAt > TIMEOUT_MS) {
      entry.resolve({ behavior: 'deny', message: 'Permission request timed out' });
      map.delete(id);
    }
  }
}

export function registerPendingPermission(
  id: string,
  toolInput: Record<string, unknown>,
  abortSignal?: AbortSignal,
): Promise<PermissionResult> {
  cleanupExpired();
  const map = getMap();

  return new Promise<PermissionResult>((resolve) => {
    map.set(id, {
      resolve,
      createdAt: Date.now(),
      abortSignal,
      toolInput,
    });

    if (abortSignal) {
      const onAbort = () => {
        if (map.has(id)) {
          resolve({ behavior: 'deny', message: 'Request aborted' });
          map.delete(id);
        }
      };
      abortSignal.addEventListener('abort', onAbort, { once: true });
    }
  });
}

export function resolvePendingPermission(
  id: string,
  result: PermissionResult,
): boolean {
  const map = getMap();
  const entry = map.get(id);
  if (!entry) return false;

  if (result.behavior === 'allow' && !result.updatedInput) {
    result = { ...result, updatedInput: entry.toolInput };
  }

  entry.resolve(result);
  map.delete(id);
  return true;
}
