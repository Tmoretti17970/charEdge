// ═══════════════════════════════════════════════════════════════════
// charEdge — Drawing Undo Toast (Sprint 25)
//
// iOS-style "Undo" toast shown after drawing deletion.
// 5-second window to undo, with progress bar countdown.
// Also: confirmation dialog for "Clear all drawings".
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from 'react';
import s from './DrawingUndoToast.module.css';

const UNDO_DURATION = 5000;

export function useDrawingUndoToast() {
  const [toast, setToast] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const timeoutRef = useRef(null);

  const triggerUndo = useCallback((deletedDrawing, bulk = false, count = 1) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast({
      drawing: deletedDrawing,
      drawings: bulk ? deletedDrawing : [deletedDrawing],
      type: bulk ? 'bulk' : 'single',
      count,
      timestamp: Date.now(),
    });
    timeoutRef.current = setTimeout(() => setToast(null), UNDO_DURATION);
  }, []);

  const dismiss = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setToast(null);
  }, []);

  const confirmClearAll = useCallback(() => setShowClearConfirm(true), []);
  const cancelClearAll = useCallback(() => setShowClearConfirm(false), []);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  return { toast, showClearConfirm, triggerUndo, dismiss, confirmClearAll, cancelClearAll };
}

export default function DrawingUndoToast({ toast, onUndo, onDismiss }) {
  const [progress, setProgress] = useState(1);

  useEffect(() => {
    if (!toast) { setProgress(1); return; }
    let rafId;
    const start = toast.timestamp;
    function tick() {
      const remaining = Math.max(0, 1 - (Date.now() - start) / UNDO_DURATION);
      setProgress(remaining);
      if (remaining > 0) rafId = requestAnimationFrame(tick);
    }
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [toast]);

  if (!toast) return null;

  const label = toast.type === 'bulk'
    ? `${toast.count} drawing${toast.count !== 1 ? 's' : ''} deleted`
    : 'Drawing deleted';

  return (
    <div className={s.toast} role="alert" aria-live="assertive">
      <span className={s.label}>{label}</span>
      <button onClick={onUndo} className={s.undoBtn} aria-label="Undo deletion">Undo</button>
      <button onClick={onDismiss} className={s.dismissBtn} aria-label="Dismiss">✕</button>
      <div className={s.progressBar} style={{ width: `${progress * 100}%` }} />
    </div>
  );
}

export function ClearAllDialog({ visible, drawingCount, onConfirm, onCancel }) {
  if (!visible) return null;
  return (
    <div className={s.clearBackdrop} onClick={onCancel} role="dialog" aria-modal="true" aria-label="Confirm clear all drawings">
      <div onClick={(e) => e.stopPropagation()} className={s.clearDialog}>
        <h3 className={s.clearTitle}>Clear All Drawings?</h3>
        <p className={s.clearDesc}>
          This will permanently delete {drawingCount} drawing{drawingCount !== 1 ? 's' : ''} from this chart.
          This action cannot be undone.
        </p>
        <div className={s.clearActions}>
          <button onClick={onCancel} className={s.cancelBtn}>Cancel</button>
          <button onClick={onConfirm} className={s.deleteBtn}>Delete All</button>
        </div>
      </div>
    </div>
  );
}
