// @ts-check
// ═══════════════════════════════════════════════════════════════════
// charEdge — Dialog Component
//
// Accessible modal dialog with focus trap and backdrop.
// Converts to bottom-sheet on mobile (<640px via CSS).
//
// Usage:
//   <Dialog open={isOpen} onClose={() => setOpen(false)} title="Settings">
//     <p>Dialog content here</p>
//   </Dialog>
//
//   <Dialog open={show} onClose={close} title="Confirm" size="sm" footer={<Button>OK</Button>}>
//     <p>Are you sure?</p>
//   </Dialog>
// ═══════════════════════════════════════════════════════════════════

import { useEffect, useRef, useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import s from '../../../styles/Dialog.module.css';

/**
 * Get all focusable elements within a container.
 * @param {HTMLElement} container
 * @returns {HTMLElement[]}
 */
function getFocusableElements(container) {
  return /** @type {HTMLElement[]} */ (
    Array.from(
      container.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled') && el.offsetParent !== null)
  );
}

/**
 * Accessible modal dialog with focus trap.
 * @param {Object} props
 * @param {boolean} props.open - Whether the dialog is visible
 * @param {() => void} props.onClose - Called on backdrop click or Escape
 * @param {string} [props.title] - Dialog title
 * @param {'sm'|'md'|'lg'} [props.size='md'] - Width variant
 * @param {React.ReactNode} props.children - Dialog body
 * @param {React.ReactNode} [props.footer] - Footer content (e.g. action buttons)
 */
export default function Dialog({ open, onClose, title, size = 'md', children, footer }) {
  const dialogRef = useRef(null);
  const previousFocusRef = useRef(null);

  // Focus trap: cycle Tab within the dialog
  const handleKeyDown = useCallback(
    (/** @type {KeyboardEvent} */ e) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusable = getFocusableElements(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  // Lock body scroll + focus management
  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement;
    document.body.style.overflow = 'hidden';

    // Focus the dialog itself (or first focusable element)
    requestAnimationFrame(() => {
      if (dialogRef.current) {
        const focusable = getFocusableElements(dialogRef.current);
        if (focusable.length > 0) {
          focusable[0].focus();
        } else {
          dialogRef.current.focus();
        }
      }
    });

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', handleKeyDown);
      // Restore focus
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === 'function') {
        previousFocusRef.current.focus();
      }
    };
  }, [open, handleKeyDown]);

  // --- CSS transition exit logic ---
  const [mounted, setMounted] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnimating(true)));
    } else {
      setAnimating(false);
    }
  }, [open]);

  const handleTransitionEnd = useCallback(() => {
    if (!open) setMounted(false);
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <div
      className={s.backdrop}
      onClick={onClose}
      role="presentation"
      onTransitionEnd={handleTransitionEnd}
      style={{
        opacity: animating ? 1 : 0,
        transition: 'opacity 200ms ease',
      }}
    >
      <div
        ref={dialogRef}
        className={`${s.dialog} ${s[size]}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'dialog-title' : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          opacity: animating ? 1 : 0,
          transform: animating ? 'translateY(0) scale(1)' : 'translateY(24px) scale(0.97)',
          transition: 'opacity 250ms cubic-bezier(0.32, 0.72, 0, 1), transform 250ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
      >
        {title && (
          <div className={s.header}>
            <h2 className={s.title} id="dialog-title">
              {title}
            </h2>
            <button className={s.closeBtn} onClick={onClose} aria-label="Close dialog">
              ✕
            </button>
          </div>
        )}

        <div className={s.body}>{children}</div>

        {footer && <div className={s.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
