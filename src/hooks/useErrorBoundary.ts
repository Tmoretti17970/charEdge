// ═══════════════════════════════════════════════════════════════════
// charEdge — useErrorBoundary Hook (Phase 5)
//
// Simple hook for functional component error recovery.
// Throws the error to be caught by the nearest React ErrorBoundary.
// ═══════════════════════════════════════════════════════════════════

import { useState, useCallback } from 'react';

/**
 * Hook that provides error throwing + reset for functional components.
 * Works with React class ErrorBoundary (like WidgetBoundary).
 *
 * Usage:
 *   const { throwError } = useErrorBoundary();
 *   try { riskyOp(); } catch (e) { throwError(e); }
 */
export function useErrorBoundary() {
  const [error, setError] = useState<Error | null>(null);

  const throwError = useCallback((err: Error) => {
    setError(err);
  }, []);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  // If error is set, throw it on next render to trigger ErrorBoundary
  if (error) throw error;

  return { throwError, reset };
}

export default useErrorBoundary;
