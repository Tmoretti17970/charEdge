// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Toast Notification System
//
// Lightweight toast notifications with auto-dismiss.
// Includes a Zustand-based store + React component + hook.
//
// Usage:
//   import { useToast, ToastContainer } from '../design/Toast.jsx';
//
//   // In your root App:
//   <ToastContainer />
//
//   // Anywhere in your app:
//   const { toast, dismiss } = useToast();
//   toast('Trade logged successfully!', 'success');
//   toast('Connection lost', 'error', { duration: 8000 });
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import s from '../../../styles/Toast.module.css';

// ─── Toast Store (vanilla — no Zustand dependency) ────────────

const VARIANT_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

let _nextId = 0;
/** @type {Array<{id: number, message: string, variant: string, duration: number, exitingAt: number|null}>} */
let _toasts = [];
/** @type {Set<() => void>} */
const _listeners = new Set();

function _emit() {
  _toasts = [..._toasts]; // new ref for useSyncExternalStore
  _listeners.forEach((fn) => fn());
}

function _subscribe(/** @type {() => void} */ fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _getSnapshot() {
  return _toasts;
}

/**
 * Add a toast notification.
 * @param {string} message - Toast message
 * @param {'success'|'error'|'warning'|'info'} [variant='info'] - Toast type
 * @param {{ duration?: number }} [options] - Options
 * @returns {number} Toast ID
 */
function addToast(message, variant = 'info', options = {}) {
  const id = ++_nextId;
  const duration = options.duration || (variant === 'error' ? 8000 : 5000);

  _toasts.push({ id, message, variant, duration, exitingAt: null });
  // Max 3 visible
  while (_toasts.length > 3) {
    _toasts.shift();
  }
  _emit();

  // Auto-dismiss
  setTimeout(() => dismissToast(id), duration);

  return id;
}

/**
 * Dismiss a toast by ID (with exit animation).
 * @param {number} id
 */
function dismissToast(id) {
  const toast = _toasts.find((t) => t.id === id);
  if (!toast || toast.exitingAt) return;

  toast.exitingAt = Date.now();
  _emit();

  // Remove after animation
  setTimeout(() => {
    _toasts = _toasts.filter((t) => t.id !== id);
    _emit();
  }, 220);
}

// ─── React Hook ──────────────────────────────────────────────

/**
 * Hook to manage toast notifications.
 * @returns {{ toast: typeof addToast, dismiss: typeof dismissToast }}
 */
export function useToast() {
  return { toast: addToast, dismiss: dismissToast };
}

// ─── React Component ─────────────────────────────────────────

/**
 * Toast container — render once in your app root.
 * Displays up to 3 stacking notifications from bottom-right.
 */
export function ToastContainer() {
  const toasts = useSyncExternalStore(_subscribe, _getSnapshot);

  if (toasts.length === 0) return null;

  return createPortal(
    <div className={s.container}>
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`${s.toast} ${s[t.variant]} ${t.exitingAt ? s.exiting : ''}`}
          onClick={() => dismissToast(t.id)}
          role="alert"
        >
          <span className={s.icon}>{VARIANT_ICONS[t.variant] || 'ℹ'}</span>
          <span className={s.message}>{t.message}</span>
          <button
            className={s.close}
            onClick={(e) => {
              e.stopPropagation();
              dismissToast(t.id);
            }}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

export default { useToast, ToastContainer };
