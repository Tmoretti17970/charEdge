// ═══════════════════════════════════════════════════════════════════
// charEdge — Accessibility Helpers
//
// Sprint 24: React hooks for accessibility:
//   - useLiveRegion: screen reader live announcements
//   - useRovingTabIndex: keyboard grid navigation
//   - useColorBlindSafe: toggle colorblind palette
//   - Localization formatters for numbers/dates/currency
// ═══════════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'react';

// ─── Live Region (screen reader announcements) ──────────────────
/**
 * Returns an announce function. When called, it updates a hidden
 * aria-live region so screen readers announce the message.
 *
 * @param {'polite'|'assertive'} priority
 * @returns {{ announce: (msg: string) => void, regionProps: object }}
 */
export function useLiveRegion(priority = 'polite') {
  const ref = useRef(null);
  const [message, setMessage] = useState('');

  const announce = useCallback((msg) => {
    // Clear and re-set to trigger re-announcement of same text
    setMessage('');
    requestAnimationFrame(() => setMessage(msg));
  }, []);

  const regionProps = {
    ref,
    role: 'status',
    'aria-live': priority,
    'aria-atomic': true,
    className: 'tf-sr-only',
    children: message,
  };

  return { announce, regionProps };
}

// ─── Roving Tab Index (keyboard grid navigation) ────────────────
/**
 * Manages focus within a container using arrow keys.
 * Attach containerProps to the grid wrapper, and call
 * getItemProps(index) on each focusable child.
 *
 * @param {number} itemCount - Number of focusable items
 * @param {object} options - { columns, orientation, loop }
 */
export function useRovingTabIndex(itemCount, options = {}) {
  const { columns = 1, orientation = 'both', loop = true } = options;
  const [activeIndex, setActiveIndex] = useState(0);
  const itemsRef = useRef([]);

  useEffect(() => {
    const el = itemsRef.current[activeIndex];
    if (el) el.focus();
  }, [activeIndex]);

  const handleKeyDown = useCallback(
    (e) => {
      let next = activeIndex;
      const isVertical = orientation === 'vertical' || orientation === 'both';
      const isHorizontal = orientation === 'horizontal' || orientation === 'both';

      switch (e.key) {
        case 'ArrowRight':
          if (!isHorizontal) return;
          next = activeIndex + 1;
          break;
        case 'ArrowLeft':
          if (!isHorizontal) return;
          next = activeIndex - 1;
          break;
        case 'ArrowDown':
          if (!isVertical) return;
          next = activeIndex + columns;
          break;
        case 'ArrowUp':
          if (!isVertical) return;
          next = activeIndex - columns;
          break;
        case 'Home':
          next = 0;
          break;
        case 'End':
          next = itemCount - 1;
          break;
        default:
          return;
      }

      e.preventDefault();

      if (loop) {
        next = ((next % itemCount) + itemCount) % itemCount;
      } else {
        next = Math.max(0, Math.min(next, itemCount - 1));
      }

      setActiveIndex(next);
    },
    [activeIndex, itemCount, columns, orientation, loop]
  );

  const containerProps = {
    role: 'grid',
    onKeyDown: handleKeyDown,
  };

  const getItemProps = (index) => ({
    ref: (el) => { itemsRef.current[index] = el; },
    tabIndex: index === activeIndex ? 0 : -1,
    role: 'gridcell',
    onFocus: () => setActiveIndex(index),
  });

  return { containerProps, getItemProps, activeIndex, setActiveIndex };
}

// ─── Color-Blind Safe Toggle ────────────────────────────────────
/**
 * Toggles the `.tf-colorblind-safe` class on the body element.
 * Persists the setting to localStorage.
 */
export function useColorBlindSafe() {
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem('tf-colorblind-safe') === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    if (enabled) {
      document.body.classList.add('tf-colorblind-safe');
    } else {
      document.body.classList.remove('tf-colorblind-safe');
    }
    try {
      localStorage.setItem('tf-colorblind-safe', String(enabled));
    } catch {
      // storage unavailable
    }
  }, [enabled]);

  return { colorBlindSafe: enabled, toggleColorBlindSafe: () => setEnabled((v) => !v) };
}

// ─── Number / Date / Currency Formatters ────────────────────────
const locale =
  typeof navigator !== 'undefined' ? navigator.language || 'en-US' : 'en-US';

/**
 * Format a number with locale-aware separators.
 */
export function formatNumber(value, opts = {}) {
  const { decimals = 2, compact = false } = opts;
  try {
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      notation: compact ? 'compact' : 'standard',
    }).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a value as currency.
 */
export function formatCurrency(value, currency = 'USD') {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
    }).format(value);
  } catch {
    return `$${value}`;
  }
}

/**
 * Format a date with locale-aware formatting.
 */
export function formatDate(date, opts = {}) {
  const { style = 'medium' } = opts;
  const options =
    style === 'short'
      ? { month: 'short', day: 'numeric' }
      : style === 'long'
        ? { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
        : { year: 'numeric', month: 'short', day: 'numeric' };
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(date));
  } catch {
    return String(date);
  }
}

/**
 * Format a relative time (e.g., "2 hours ago").
 */
export function formatRelativeTime(date) {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  try {
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    if (minutes < 1) return rtf.format(0, 'minute');
    if (minutes < 60) return rtf.format(-minutes, 'minute');
    if (hours < 24) return rtf.format(-hours, 'hour');
    return rtf.format(-days, 'day');
  } catch {
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  }
}
