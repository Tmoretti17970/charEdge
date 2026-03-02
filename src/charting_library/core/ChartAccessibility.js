// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Accessibility & Internationalization (Sprint 24)
// ARIA labels, keyboard navigation, screen reader support,
// and RTL/locale-aware number formatting.
// ═══════════════════════════════════════════════════════════════════

/**
 * ARIA role and label generator for chart elements.
 */
export function getChartAriaProps(symbol, tf, lastPrice, priceChange) {
  return {
    role: 'img',
    'aria-label': `${symbol} ${tf} chart. Current price ${formatPrice(lastPrice)}. ${priceChange >= 0 ? 'Up' : 'Down'} ${Math.abs(priceChange).toFixed(2)} percent.`,
    tabIndex: 0,
  };
}

/**
 * Keyboard navigation handler for chart.
 * Returns a keydown event handler.
 */
export function createChartKeyboardNav(engine) {
  const KEYS = {
    ArrowLeft: () => engine?.pan?.(-50),
    ArrowRight: () => engine?.pan?.(50),
    ArrowUp: () => engine?.zoomIn?.(),
    ArrowDown: () => engine?.zoomOut?.(),
    Home: () => engine?.goToStart?.(),
    End: () => engine?.goToEnd?.(),
    'r': () => engine?.resetZoom?.(),
    '+': () => engine?.zoomIn?.(),
    '-': () => engine?.zoomOut?.(),
    Escape: () => engine?.cancelTool?.(),
  };

  return (e) => {
    const handler = KEYS[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  };
}

/**
 * Screen reader announcer — creates an aria-live region
 * for announcing chart updates.
 */
export class ChartAnnouncer {
  constructor() {
    this.el = null;
  }

  mount() {
    this.el = document.createElement('div');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    this.el.setAttribute('role', 'status');
    this.el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    document.body.appendChild(this.el);
  }

  announce(message) {
    if (this.el) {
      this.el.textContent = '';
      requestAnimationFrame(() => {
        if (this.el) this.el.textContent = message;
      });
    }
  }

  unmount() {
    this.el?.remove();
    this.el = null;
  }
}

// ─── Internationalization ────────────────────────────────

const LOCALES = {
  en: { decimal: '.', thousands: ',', currency: '$', dir: 'ltr' },
  de: { decimal: ',', thousands: '.', currency: '€', dir: 'ltr' },
  ja: { decimal: '.', thousands: ',', currency: '¥', dir: 'ltr' },
  ar: { decimal: '.', thousands: ',', currency: 'د.إ', dir: 'rtl' },
  ko: { decimal: '.', thousands: ',', currency: '₩', dir: 'ltr' },
  zh: { decimal: '.', thousands: ',', currency: '¥', dir: 'ltr' },
  pt: { decimal: ',', thousands: '.', currency: 'R$', dir: 'ltr' },
  fr: { decimal: ',', thousands: ' ', currency: '€', dir: 'ltr' },
};

let _currentLocale = 'en';

export function setChartLocale(locale) {
  _currentLocale = LOCALES[locale] ? locale : 'en';
}

export function getChartLocale() {
  return _currentLocale;
}

export function getLocaleConfig() {
  return LOCALES[_currentLocale] || LOCALES.en;
}

/**
 * Format a number for the current locale.
 */
export function formatPrice(price, decimals = 2) {
  if (price == null || isNaN(price)) return '—';
  const locale = getLocaleConfig();
  const parts = Math.abs(price).toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, locale.thousands);
  const formatted = parts.join(locale.decimal);
  return price < 0 ? `-${formatted}` : formatted;
}

export function formatVolume(vol) {
  if (vol == null || isNaN(vol)) return '—';
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toFixed(0);
}

export function formatCurrency(amount, decimals = 2) {
  const locale = getLocaleConfig();
  return `${locale.currency}${formatPrice(amount, decimals)}`;
}

/**
 * Get chart direction (RTL support).
 */
export function getChartDirection() {
  return getLocaleConfig().dir;
}

/**
 * Localized time format for chart labels.
 */
export function formatChartTime(timestamp, tf = '1h') {
  const date = new Date(timestamp);
  const locale = _currentLocale;
  const options = {};

  if (['1m', '5m', '15m'].includes(tf)) {
    options.hour = '2-digit';
    options.minute = '2-digit';
  } else if (['1h', '4h'].includes(tf)) {
    options.month = 'short';
    options.day = 'numeric';
    options.hour = '2-digit';
  } else {
    options.year = 'numeric';
    options.month = 'short';
    options.day = 'numeric';
  }

  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    return date.toLocaleString();
  }
}
