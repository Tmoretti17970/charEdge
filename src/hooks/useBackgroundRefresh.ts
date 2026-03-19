// ═══════════════════════════════════════════════════════════════════
// charEdge — Background Refresh Hook (Sprint 66)
//
// Manages the data worker lifecycle, message handling, and
// error recovery. Provides sparkline, fundamental, and news
// data to the rest of the app.
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';

interface BackgroundRefreshState {
  /** Worker status */
  status: 'idle' | 'running' | 'stopped' | 'error';
  /** Last sparkline update time */
  lastSparklineUpdate: number | null;
  /** Last fundamentals update time */
  lastFundamentalsUpdate: number | null;
  /** Last news update time */
  lastNewsUpdate: number | null;
  /** Last error */
  error: string | null;
}

interface BackgroundRefreshCallbacks {
  onSparklines?: (data: Record<string, unknown>) => void;
  onFundamentals?: (data: Record<string, unknown>) => void;
  onNews?: (data: unknown[]) => void;
}

/**
 * Hook to manage the background data refresh worker.
 */
export function useBackgroundRefresh(
  symbols: string[],
  callbacks: BackgroundRefreshCallbacks = {},
) {
  const workerRef = useRef<Worker | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  const [state, setState] = useState<BackgroundRefreshState>({
    status: 'idle',
    lastSparklineUpdate: null,
    lastFundamentalsUpdate: null,
    lastNewsUpdate: null,
    error: null,
  });

  // Initialize worker
  useEffect(() => {
    if (!symbols.length) return;

    try {
      const worker = new Worker(
        new URL('../workers/dataWorker.js', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (e: MessageEvent) => {
        const { type, data, error, status } = e.data;

        switch (type) {
          case 'status':
            setState(s => ({ ...s, status }));
            break;
          case 'sparklines':
            setState(s => ({ ...s, lastSparklineUpdate: Date.now() }));
            callbacksRef.current.onSparklines?.(data);
            break;
          case 'fundamentals':
            setState(s => ({ ...s, lastFundamentalsUpdate: Date.now() }));
            callbacksRef.current.onFundamentals?.(data);
            break;
          case 'news':
            setState(s => ({ ...s, lastNewsUpdate: Date.now() }));
            callbacksRef.current.onNews?.(data);
            break;
          case 'error':
            setState(s => ({ ...s, error: error || 'Worker error' }));
            break;
        }
      };

      worker.onerror = () => {
        setState(s => ({ ...s, status: 'error', error: 'Worker crashed' }));
      };

      // Start the worker
      worker.postMessage({ type: 'init', payload: { symbols } });
      workerRef.current = worker;

      return () => {
        worker.postMessage({ type: 'stop' });
        worker.terminate();
        workerRef.current = null;
      };
    } catch {
      setState(s => ({ ...s, status: 'error', error: 'Worker initialization failed' }));
    }
  }, [symbols.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update symbols when they change
  useEffect(() => {
    if (workerRef.current && symbols.length) {
      workerRef.current.postMessage({
        type: 'updateSymbols',
        payload: { symbols },
      });
    }
  }, [symbols]);

  // Manual refresh trigger
  const refreshNow = useCallback((target: 'sparklines' | 'fundamentals' | 'news') => {
    workerRef.current?.postMessage({ type: 'refreshNow', payload: { target } });
  }, []);

  return {
    ...state,
    refreshNow,
  };
}

export default useBackgroundRefresh;
