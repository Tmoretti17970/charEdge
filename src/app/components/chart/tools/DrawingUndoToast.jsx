// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Undo Toast (Sprint 25)
//
// iOS-style "Undo" toast shown after drawing deletion.
// 5-second window to undo, with progress bar countdown.
// Also: confirmation dialog for "Clear all drawings".
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';

const UNDO_DURATION = 5000; // 5 seconds

/**
 * Hook to manage undo state for drawing deletions.
 * Returns { showToast, deletedDrawing, triggerUndo, confirmClearAll, dismiss }
 */
export function useDrawingUndoToast() {
  const [toast, setToast] = useState(null); // { drawing, type: 'single' | 'bulk', count }
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const timeoutRef = useRef(null);

  const triggerUndo = useCallback((deletedDrawing, bulk = false, count = 1) => {
    // Cancel any existing toast
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setToast({
      drawing: deletedDrawing,
      drawings: bulk ? deletedDrawing : [deletedDrawing],
      type: bulk ? 'bulk' : 'single',
      count,
      timestamp: Date.now(),
    });

    timeoutRef.current = setTimeout(() => {
      setToast(null);
    }, UNDO_DURATION);
  }, []);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  const confirmClearAll = useCallback(() => {
    setShowClearConfirm(true);
  }, []);

  const cancelClearAll = useCallback(() => {
    setShowClearConfirm(false);
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  return {
    toast,
    showClearConfirm,
    triggerUndo,
    dismiss,
    confirmClearAll,
    cancelClearAll,
  };
}

/**
 * Undo toast component — renders at bottom of chart.
 */
export default function DrawingUndoToast({ toast, onUndo, onDismiss }) {
  const [progress, setProgress] = useState(1);

  // Animate progress bar countdown
  useEffect(() => {
    if (!toast) { setProgress(1); return; }

    let rafId;
    const start = toast.timestamp;

    function tick() {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / UNDO_DURATION);
      setProgress(remaining);
      if (remaining > 0) {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [toast]);

  if (!toast) return null;

  const label = toast.type === 'bulk'
    ? `${toast.count} drawing${toast.count !== 1 ? 's' : ''} deleted`
    : `Drawing deleted`;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 16px',
        background: 'rgba(30, 33, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12,
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        zIndex: 600,
        animation: 'drawingToastIn 0.2s ease-out',
        overflow: 'hidden',
      }}
      role="alert"
      aria-live="assertive"
    >
      {/* Label */}
      <span style={{
        fontSize: 12,
        fontWeight: 500,
        color: '#D1D4DC',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        whiteSpace: 'nowrap',
      }}>
        {label}
      </span>

      {/* Undo button */}
      <button
        onClick={onUndo}
        style={{
          padding: '4px 12px',
          borderRadius: 6,
          background: 'rgba(41, 98, 255, 0.15)',
          border: '1px solid rgba(41, 98, 255, 0.25)',
          color: '#2962FF',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          whiteSpace: 'nowrap',
        }}
        aria-label="Undo deletion"
      >
        Undo
      </button>

      {/* Close */}
      <button
        onClick={onDismiss}
        style={{
          width: 20, height: 20,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
          border: 'none',
          color: '#787B86',
          cursor: 'pointer',
          fontSize: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-label="Dismiss"
      >
        ✕
      </button>

      {/* Progress bar */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: `${progress * 100}%`,
          background: 'rgba(41, 98, 255, 0.5)',
          borderRadius: '0 0 12px 12px',
          transition: 'width 0.05s linear',
        }}
      />
    </div>
  );
}

/**
 * Clear all confirmation dialog.
 */
export function ClearAllDialog({ visible, drawingCount, onConfirm, onCancel }) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label="Confirm clear all drawings"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'rgba(30, 33, 42, 0.98)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: '24px',
          maxWidth: 320,
          boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        }}
      >
        <h3 style={{
          fontSize: 16, fontWeight: 600, color: '#D1D4DC',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          margin: '0 0 8px',
        }}>
          Clear All Drawings?
        </h3>
        <p style={{
          fontSize: 13, color: '#787B86', margin: '0 0 20px',
          fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          lineHeight: 1.4,
        }}>
          This will permanently delete {drawingCount} drawing{drawingCount !== 1 ? 's' : ''} from this chart.
          This action cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#D1D4DC', fontSize: 13, fontWeight: 500,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 16px', borderRadius: 8,
              background: 'rgba(239,83,80,0.15)',
              border: '1px solid rgba(239,83,80,0.25)',
              color: '#EF5350', fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
            }}
          >
            Delete All
          </button>
        </div>
      </div>
    </div>
  );
}
