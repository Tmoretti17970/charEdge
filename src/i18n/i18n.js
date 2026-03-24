// ═══════════════════════════════════════════════════════════════════
// charEdge — Internationalization (i18n) System (Phase 6)
//
// Lightweight i18n without external dependencies.
// Uses JSON locale files + React context for string resolution.
//
// Usage:
//   import { t, setLocale, getLocale } from '@/i18n/i18n';
//   t('nav.home')         → "Home"
//   t('trade.pnl', { value: '+$500' }) → "P&L: +$500"
//
// Adding a new language:
//   1. Create src/i18n/locales/xx.json (copy en.json structure)
//   2. Translate all strings
//   3. Add to SUPPORTED_LOCALES below
// ═══════════════════════════════════════════════════════════════════

import { useState, useEffect } from 'react';
import en from './locales/en.json';

// ─── Supported Locales ──────────────────────────────────────────

export const SUPPORTED_LOCALES = [
  { code: 'en', name: 'English', native: 'English', rtl: false },
  { code: 'es', name: 'Spanish', native: 'Español', rtl: false },
  { code: 'pt', name: 'Portuguese', native: 'Português', rtl: false },
  { code: 'zh', name: 'Chinese', native: '中文', rtl: false },
  { code: 'ja', name: 'Japanese', native: '日本語', rtl: false },
  { code: 'ko', name: 'Korean', native: '한국어', rtl: false },
  { code: 'ru', name: 'Russian', native: 'Русский', rtl: false },
  { code: 'ar', name: 'Arabic', native: 'العربية', rtl: true },
];

// ─── State ──────────────────────────────────────────────────────

let _locale = 'en';
let _messages = en;
const _cache = new Map();
_cache.set('en', en);
const _listeners = new Set();

// ─── Core API ───────────────────────────────────────────────────

/**
 * Translate a key with optional interpolation.
 * @param {string} key - Dot-separated key (e.g., 'nav.home')
 * @param {Record<string, string|number>} [params] - Interpolation values
 * @returns {string} Translated string or key as fallback
 */
export function t(key, params) {
  let value = _resolve(_messages, key);

  // Fallback to English if key not found in current locale
  if (value === undefined && _locale !== 'en') {
    value = _resolve(en, key);
  }

  // Return key if no translation found
  if (value === undefined) return key;

  // Interpolate {param} placeholders
  if (params && typeof value === 'string') {
    return value.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? String(params[k]) : `{${k}}`));
  }

  return value;
}

/**
 * Get current locale code.
 */
export function getLocale() {
  return _locale;
}

/**
 * Get locale info (name, native name, RTL flag).
 */
export function getLocaleInfo() {
  return SUPPORTED_LOCALES.find((l) => l.code === _locale) || SUPPORTED_LOCALES[0];
}

/**
 * Set active locale. Loads locale file lazily if not cached.
 * @param {string} code - Locale code (e.g., 'es', 'zh')
 */
export async function setLocale(code) {
  const supported = SUPPORTED_LOCALES.find((l) => l.code === code);
  if (!supported) return;

  // Use cached messages if available
  if (_cache.has(code)) {
    _locale = code;
    _messages = _cache.get(code);
    _applyRTL(supported.rtl);
    _notifyListeners();
    _persist(code);
    return;
  }

  // Lazy-load locale file
  try {
    const module = await import(`./locales/${code}.json`);
    const messages = module.default || module;
    _cache.set(code, messages);
    _locale = code;
    _messages = messages;
    _applyRTL(supported.rtl);
    _notifyListeners();
    _persist(code);
  } catch {
    // Locale file not found — stay on current locale
    // eslint-disable-next-line no-console
    console.warn(`[i18n] Locale file not found: ${code}.json`);
  }
}

/**
 * Subscribe to locale changes.
 * @param {Function} listener
 * @returns {Function} unsubscribe
 */
export function onLocaleChange(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/**
 * Format a number according to current locale.
 */
export function formatNumber(value, options) {
  try {
    return new Intl.NumberFormat(_locale, options).format(value);
  } catch {
    return String(value);
  }
}

/**
 * Format a date according to current locale.
 */
export function formatDate(date, options) {
  try {
    return new Intl.DateTimeFormat(_locale, options).format(typeof date === 'string' ? new Date(date) : date);
  } catch {
    return String(date);
  }
}

/**
 * Format currency amount.
 */
export function formatCurrency(value, currency = 'USD') {
  return formatNumber(value, { style: 'currency', currency, minimumFractionDigits: 2 });
}

// ─── React Hook ─────────────────────────────────────────────────

/**
 * React hook for i18n. Re-renders on locale change.
 * @returns {{ t, locale, setLocale, formatNumber, formatDate, formatCurrency }}
 */
export function useI18n() {
  const [, setTick] = useState(0);

  useEffect(() => {
    return onLocaleChange(() => setTick((n) => n + 1));
  }, []);

  return { t, locale: _locale, setLocale, formatNumber, formatDate, formatCurrency, getLocaleInfo };
}

// ─── Internal ───────────────────────────────────────────────────

function _resolve(obj, path) {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function _notifyListeners() {
  for (const fn of _listeners) {
    try {
      fn(_locale);
    } catch {
      /* ignore listener errors */
    }
  }
}

function _applyRTL(isRtl) {
  if (typeof document !== 'undefined') {
    document.documentElement.dir = isRtl ? 'rtl' : 'ltr';
    document.documentElement.lang = _locale;
  }
}

function _persist(code) {
  try {
    localStorage.setItem('charEdge:locale', code);
  } catch {
    /* storage blocked */
  }
}

// ─── Init: Restore saved locale ─────────────────────────────────

function _init() {
  try {
    const saved = localStorage.getItem('charEdge:locale');
    if (saved && SUPPORTED_LOCALES.some((l) => l.code === saved)) {
      if (saved !== 'en') setLocale(saved);
      else _locale = 'en';
    } else {
      // Auto-detect from browser
      const browserLang = navigator.language?.slice(0, 2);
      if (browserLang && browserLang !== 'en' && SUPPORTED_LOCALES.some((l) => l.code === browserLang)) {
        setLocale(browserLang);
      }
    }
  } catch {
    /* SSR safe */
  }
}

if (typeof window !== 'undefined') _init();

export default { t, getLocale, setLocale, formatNumber, formatDate, formatCurrency, useI18n, SUPPORTED_LOCALES };
