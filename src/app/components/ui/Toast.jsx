// ═══════════════════════════════════════════════════════════════════
// charEdge v10 — Toast Notification System
// Sprint 4: Framer Motion entrance/exit, max 3 visible, glassmorphic
// Sprint CSS Surgery: Added priority system (critical = persistent, no auto-dismiss)
// Usage: toast.success('Trade added') / toast.critical('WebSocket disconnected')
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useState, useRef, useCallback, forwardRef } from 'react';
import { create } from 'zustand';
import { C, F } from '../../../constants.js';
import { notificationLog } from '../../../state/useNotificationStore';

// ─── Toast Store ────────────────────────────────────────────────

let _toastId = 0;
// Suppress non-critical toasts during startup to avoid notification flood
const _bootTime = Date.now();
const STARTUP_GRACE_MS = 3000;
function _isStartup() { return Date.now() - _bootTime < STARTUP_GRACE_MS; }

const useToastStore = create((set) => ({
  toasts: [],
  add: (toast) =>
    set((s) => {
      // P2 2.4: Dedupe — skip if same type+message exists within 2s
      const now = Date.now();
      const isDupe = s.toasts.some(
        (t) => t.type === toast.type && t.message === toast.message && (now - (t._addedAt || 0)) < 2000
      );
      if (isDupe) return s;
      return {
        toasts: [...s.toasts.slice(-6), { ...toast, id: ++_toastId, priority: toast.priority || 'normal', _addedAt: now }],
      };
    }),
  remove: (id) =>
    set((s) => ({
      toasts: s.toasts.filter((t) => t.id !== id),
    })),
}));

// ─── Public API ─────────────────────────────────────────────────

function _log(type, message, category) {
  try {
    notificationLog.push({ type, message, category: category || 'system' });
  // eslint-disable-next-line unused-imports/no-unused-vars
  } catch (_) { /* storage/API may be blocked */ }
}

export const toast = {
  success: (message, duration = 3000) => {
    _log('success', message);
    if (_isStartup()) return; // suppress during boot
    return useToastStore.getState().add({ type: 'success', message, duration });
  },
  error: (message, duration = 5000) => {
    _log('error', message);
    return useToastStore.getState().add({ type: 'error', message, duration });
  },
  warning: (message, duration = 4000) => {
    _log('warning', message);
    if (_isStartup()) return; // suppress during boot
    return useToastStore.getState().add({ type: 'warning', message, duration });
  },
  info: (message, duration = 3000) => {
    _log('info', message);
    if (_isStartup()) return; // suppress during boot
    return useToastStore.getState().add({ type: 'info', message, duration });
  },
  /**
   * Show a toast with an action button (e.g. "Undo").
   * @param {string} message
   * @param {string} actionLabel - Button text (e.g. 'Undo')
   * @param {Function} actionFn - Called when button is clicked
   * @param {Object} [opts]
   * @param {string} [opts.type='info'] - Toast type
   * @param {number} [opts.duration=5000] - Duration in ms
   */
  action: (message, actionLabel, actionFn, opts = {}) => {
    _log(opts.type || 'info', message);
    return useToastStore.getState().add({
      type: opts.type || 'info',
      message,
      duration: opts.duration || 5000,
      actionLabel,
      actionFn,
    });
  },
  /**
   * Show a critical toast — persistent, requires manual close.
   * Use for errors that need user attention (e.g. connection lost).
   * @param {string} message
   * @param {Object} [opts]
   * @param {number} [opts.duration=0] - 0 = persistent (no auto-dismiss)
   */
  critical: (message, opts = {}) => {
    _log('error', message, 'critical');
    return useToastStore.getState().add({
      type: 'error',
      message,
      duration: opts.duration || 0,
      priority: 'critical',
    });
  },
};

// ─── Toast Container (Sprint 4: max 3 visible) ─────────────────

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  // Sort: critical first, then normal. Max 2 critical + 3 normal
  const criticalToasts = toasts.filter(t => t.priority === 'critical').slice(-2);
  const normalToasts = toasts.filter(t => t.priority !== 'critical').slice(-3);
  const visibleToasts = [...criticalToasts, ...normalToasts];

  return (
    <div
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {visibleToasts.map((t) => (
        <Toast key={t.id} toast={t} />
      ))}
    </div>
  );
}

// ─── Individual Toast (Sprint 5: pause-on-hover) ─────────────────

const Toast = forwardRef(function Toast({ toast: t }, ref) {
  const remove = useToastStore((s) => s.remove);
  const prefersReducedMotion = useRef(
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const remainingRef = useRef(t.duration);
  const startTimeRef = useRef(null);
  const timerRef = useRef(null);
  const isCritical = t.priority === 'critical';

  // Start / resume the dismiss timer
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setTimeout(() => remove(t.id), remainingRef.current);
  }, [t.id, remove]);

  // Pause timer and track remaining time
  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (startTimeRef.current) {
      const elapsed = Date.now() - startTimeRef.current;
      remainingRef.current = Math.max(remainingRef.current - elapsed, 200);
    }
  }, []);

  // Initial start — skip auto-dismiss for critical toasts
  useEffect(() => {
    if (!isCritical) {
      startTimer();
      requestAnimationFrame(() => setProgress(0));
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [t.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleMouseEnter = useCallback(() => {
    setPaused(true);
    pauseTimer();
    const elapsed = startTimeRef.current ? Date.now() - startTimeRef.current : 0;
    const pct = Math.max(0, (1 - elapsed / t.duration) * 100);
    setProgress(pct);
  }, [pauseTimer, t.duration]);

  const handleMouseLeave = useCallback(() => {
    setPaused(false);
    startTimer();
    requestAnimationFrame(() => setProgress(0));
  }, [startTimer]);

  const colors = {
    success: { bg: C.g + '15', border: C.g + '40', icon: '✓', color: C.g },
    error: { bg: C.r + '15', border: C.r + '40', icon: '✕', color: C.r },
    warning: { bg: C.y + '15', border: C.y + '40', icon: '⚠', color: C.y },
    info: { bg: C.b + '15', border: C.b + '40', icon: 'ℹ', color: C.b },
  };

  const c = colors[t.type] || colors.info;

  // CSS keyframe entrance animation
  const animationStyle = prefersReducedMotion.current
    ? {}
    : {
      animation: 'tf-toast-in 250ms cubic-bezier(0.32, 0.72, 0, 1) both',
    };

  return (
    <div
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        background: C.sf,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.color}`,
        borderRadius: 10,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 260,
        maxWidth: 380,
        pointerEvents: 'auto',
        boxShadow: isCritical
          ? `0 8px 24px rgba(0,0,0,.35), 0 0 12px ${c.color}20, 0 0 0 1px ${c.color}15`
          : `0 8px 24px rgba(0,0,0,.25), 0 0 0 1px ${c.color}08`,
        position: 'relative',
        overflow: 'hidden',
        ...animationStyle,
      }}
    >
      <span style={{ fontSize: 14, color: c.color, flexShrink: 0 }}>{c.icon}</span>
      <span style={{ fontSize: 12, color: C.t1, fontFamily: F, lineHeight: 1.4, flex: 1 }}>{t.message}</span>
      {t.actionLabel && t.actionFn && (
        <button
          className="tf-btn"
          onClick={() => {
            t.actionFn();
            remove(t.id);
          }}
          style={{
            background: c.color + '20',
            border: `1px solid ${c.color}50`,
            borderRadius: 6,
            color: c.color,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: F,
            cursor: 'pointer',
            padding: '4px 10px',
            flexShrink: 0,
            transition: 'background 0.15s',
          }}
        >
          {t.actionLabel}
        </button>
      )}
      <button
        className="tf-btn"
        onClick={() => remove(t.id)}
        style={{
          background: 'none',
          border: 'none',
          color: C.t3,
          fontSize: 14,
          cursor: 'pointer',
          padding: '0 2px',
          flexShrink: 0,
        }}
      >
        ×
      </button>
      {/* Progress bar — pauses on hover */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: 2,
          width: `${progress}%`,
          background: c.color,
          borderRadius: '0 0 10px 10px',
          transition: paused ? 'none' : `width ${remainingRef.current}ms linear`,
          opacity: 0.6,
        }}
      />
    </div>
  );
});

export default toast;
