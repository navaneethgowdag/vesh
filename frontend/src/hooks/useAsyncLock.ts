import { useState, useRef, useCallback } from 'react';

/**
 * useAsyncLock
 *
 * Prevents rapid double-clicks and duplicate API requests by combining
 * a synchronous ref lock with React state for UI disabling.
 */
export function useAsyncLock() {
  const [isLoading, setIsLoading] = useState(false);
  const isLockedRef = useRef(false);

  const execute = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T | undefined> => {
      // Synchronous gate check: drops duplicate events fired within the same tick
      if (isLockedRef.current) {
        return undefined;
      }

      isLockedRef.current = true;
      setIsLoading(true);

      try {
        const result = await asyncFn();
        return result;
      } finally {
        isLockedRef.current = false;
        setIsLoading(false);
      }
    },
    []
  );

  return {
    isLoading,
    isLocked: isLoading,
    execute,
  };
}

/**
 * useKeyedAsyncLock
 *
 * Independent per-item locks for lists of actions (e.g. liking post A
 * without blocking post B, or deleting item X without disabling item Y).
 */
export function useKeyedAsyncLock() {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set());
  const lockedIdsRef = useRef<Set<string>>(new Set());

  const isItemLocked = useCallback((id: string): boolean => {
    return lockedIdsRef.current.has(id);
  }, []);

  const executeWithKey = useCallback(
    async <T>(id: string, asyncFn: () => Promise<T>): Promise<T | undefined> => {
      if (!id || lockedIdsRef.current.has(id)) {
        return undefined;
      }

      lockedIdsRef.current.add(id);
      setLoadingIds((prev) => new Set(prev).add(id));

      try {
        const result = await asyncFn();
        return result;
      } finally {
        lockedIdsRef.current.delete(id);
        setLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    },
    []
  );

  return {
    loadingIds,
    isItemLocked,
    executeWithKey,
  };
}
