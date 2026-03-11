// ═══════════════════════════════════════════════════════════════════
// charEdge — Chart Accessibility & Internationalization (TypeScript)
// ARIA labels, keyboard navigation, screen reader support,
// and RTL/locale-aware number formatting.
// ═══════════════════════════════════════════════════════════════════

// ─── Types ──────────────────────────────────────────────────────

export interface ChartAriaProps {
  role: 'img';
  'aria-label': string;
  tabIndex: 0;
}

export interface ChartEngine {
  pan?: (delta: number) => void;
  zoomIn?: () => void;
  zoomOut?: () => void;
  goToStart?: () => void;
  goToEnd?: () => void;
  resetZoom?: () => void;
  cancelTool?: () => void;
}

export type LocaleCode = 'en' | 'de' | 'ja' | 'ar' | 'ko' | 'zh' | 'pt' | 'fr';

export interface LocaleConfig {
  decimal: string;
  thousands: string;
  currency: string;
  dir: 'ltr' | 'rtl';
}

// ─── ARIA Props ─────────────────────────────────────────────────

export function getChartAriaProps(
  symbol: string,
  tf: string,
  lastPrice: number,
  priceChange: number,
): ChartAriaProps {
  return {
    role: 'img',
    'aria-label': `${symbol} ${tf} chart. Current price ${formatPrice(lastPrice)}. ${priceChange >= 0 ? 'Up' : 'Down'} ${Math.abs(priceChange).toFixed(2)} percent.`,
    tabIndex: 0,
  };
}

// ─── Keyboard Navigation ────────────────────────────────────────

export function createChartKeyboardNav(engine: ChartEngine): (e: KeyboardEvent) => void {
  const KEYS: Record<string, () => void> = {
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

  return (e: KeyboardEvent) => {
    const handler = KEYS[e.key];
    if (handler) {
      e.preventDefault();
      handler();
    }
  };
}

// ─── Screen Reader Announcer ────────────────────────────────────

export class ChartAnnouncer {
  el: HTMLDivElement | null;

  constructor() {
    this.el = null;
  }

  mount(): void {
    this.el = document.createElement('div');
    this.el.setAttribute('aria-live', 'polite');
    this.el.setAttribute('aria-atomic', 'true');
    this.el.setAttribute('role', 'status');
    this.el.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);';
    document.body.appendChild(this.el);
  }

  announce(message: string): void {
    if (this.el) {
      this.el.textContent = '';
      requestAnimationFrame(() => {
        if (this.el) this.el.textContent = message;
      });
    }
  }

  unmount(): void {
    this.el?.remove();
    this.el = null;
  }
}

// ─── Internationalization ───────────────────────────────────────

const LOCALES: Record<LocaleCode, LocaleConfig> = {
  en: { decimal: '.', thousands: ',', currency: '$', dir: 'ltr' },
  de: { decimal: ',', thousands: '.', currency: '€', dir: 'ltr' },
  ja: { decimal: '.', thousands: ',', currency: '¥', dir: 'ltr' },
  ar: { decimal: '.', thousands: ',', currency: 'د.إ', dir: 'rtl' },
  ko: { decimal: '.', thousands: ',', currency: '₩', dir: 'ltr' },
  zh: { decimal: '.', thousands: ',', currency: '¥', dir: 'ltr' },
  pt: { decimal: ',', thousands: '.', currency: 'R$', dir: 'ltr' },
  fr: { decimal: ',', thousands: ' ', currency: '€', dir: 'ltr' },
};

let _currentLocale: LocaleCode = 'en';

export function setChartLocale(locale: string): void {
  _currentLocale = (locale in LOCALES ? locale : 'en') as LocaleCode;
}

export function getChartLocale(): LocaleCode {
  return _currentLocale;
}

export function getLocaleConfig(): LocaleConfig {
  return LOCALES[_currentLocale] || LOCALES.en;
}

export function formatPrice(price: number | null | undefined, decimals: number = 2): string {
  if (price == null || isNaN(price)) return '—';
  const locale = getLocaleConfig();
  const parts = Math.abs(price).toFixed(decimals).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, locale.thousands);
  const formatted = parts.join(locale.decimal);
  return price < 0 ? `-${formatted}` : formatted;
}

export function formatVolume(vol: number | null | undefined): string {
  if (vol == null || isNaN(vol)) return '—';
  if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
  if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
  if (vol >= 1e3) return (vol / 1e3).toFixed(1) + 'K';
  return vol.toFixed(0);
}

export function formatCurrency(amount: number, decimals: number = 2): string {
  const locale = getLocaleConfig();
  return `${locale.currency}${formatPrice(amount, decimals)}`;
}

export function getChartDirection(): 'ltr' | 'rtl' {
  return getLocaleConfig().dir;
}

export function formatChartTime(timestamp: number, tf: string = '1h'): string {
  const date = new Date(timestamp);
  const locale = _currentLocale;
  const options: Intl.DateTimeFormatOptions = {};

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (_) {
    return date.toLocaleString();
  }
}
